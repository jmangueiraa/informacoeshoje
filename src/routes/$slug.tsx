import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

// 1. Lista de User-Agents de bots e crawlers conhecidos
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'WhatsApp',
  'TelegramBot',
  'Twitterbot',
  'LinkedInBot',
  'Slackbot-LinkExpanding',
  'Discordbot',
  'Googlebot',
  'bingbot',
  'applebot',
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'facebot',
  'ia_archiver',
  'petalbot',
  'bytespider',
  'semrushbot',
  'ahrefsbot',
  'preview',
  'crawler',
  'spider',
  'curl',
  'wget',
  'python-requests',
  'headlesschrome',
  'lighthouse',
]

function isBotOrPrefetchRequest(request?: Request): boolean {
  if (!request) return false

  const userAgent = request.headers.get('user-agent') || ''
  const purpose = (
    request.headers.get('purpose') ||
    request.headers.get('sec-purpose') ||
    request.headers.get('x-purpose') ||
    request.headers.get('x-moz') ||
    ''
  ).toLowerCase()

  if (purpose.includes('prefetch') || purpose.includes('preview')) {
    return true
  }

  return BOT_USER_AGENTS.some((bot) =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  )
}

function getClientIp(request?: Request): string {
  if (!request) return '0.0.0.0'
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  )
}

export const Route = createFileRoute('/$slug')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const slug = String(params.slug ?? '').replace(/^\/+|\/+$/g, '')
        if (!slug || slug.includes('.')) {
          return new Response('Not found', { status: 404 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // 1. Busca o link ativo correspondente ao slug
        const { data: link } = await supabaseAdmin
          .from('links')
          .select('id, affiliate_url, status, clicks_count, expires_at')
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle()

        if (!link?.affiliate_url) {
          return new Response('Link não encontrado', { status: 404 })
        }

        const isBot = isBotOrPrefetchRequest(request)

        // 2. Se for humano, registra o clique por IP com fallback garantido
        if (!isBot) {
          try {
            const clientIp = getClientIp(request)
            const { error: rpcError } = await supabaseAdmin.rpc('register_link_click', {
              p_link_id: link.id,
              p_ip: clientIp,
            })

            // Fallback caso a RPC register_link_click ainda não tenha sido executada no Supabase
            if (rpcError) {
              await supabaseAdmin.from('clicks').insert({
                link_id: link.id,
                ip_address: clientIp,
              })
              await supabaseAdmin.rpc('incrementar_clique', { link_slug: slug })
              await supabaseAdmin
                .from('links')
                .update({ clicks_count: (link.clicks_count || 0) + 1 })
                .eq('id', link.id)
            }
          } catch (trackError) {
            console.error('Erro ao registrar clique:', trackError)
            try {
              await supabaseAdmin.from('clicks').insert({ link_id: link.id })
            } catch (_) {}
          }
        }

        // 3. Redireciona imediatamente para a URL de afiliado
        return new Response(null, {
          status: 302,
          headers: {
            Location: link.affiliate_url,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        })
      },
    },
  },
  component: RedirectPage,
})

function RedirectPage() {
  const { slug } = Route.useParams()
  const executouIncremento = useRef(false)

  useEffect(() => {
    if (!slug || executouIncremento.current) return
    executouIncremento.current = true // Trava para não executar múltiplas vezes no cliente

    const processRedirect = async () => {
      const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '')
      if (!cleanSlug || cleanSlug.includes('.')) return

      try {
        const { data: link, error } = await supabase
          .from('links')
          .select('id, affiliate_url, status, clicks_count')
          .eq('slug', cleanSlug)
          .maybeSingle()

        if (error || !link) {
          window.location.replace('/')
          return
        }

        if (link.status !== 'active') {
          alert('Este link está inativo.')
          return
        }

        // Filtra User-Agents de bots / crawlers
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
        const isBot = BOT_USER_AGENTS.some((bot) => userAgent.includes(bot.toLowerCase()))

        // Se for humano, registra clique de forma resiliente
        if (!isBot) {
          try {
            // Busca IP com timeout de 600ms para não travar o redirecionamento
            let clientIp = 'direct-client'
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 600)
              const ipRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal })
              clearTimeout(timeoutId)
              const ipData = await ipRes.json()
              clientIp = ipData.ip || 'direct-client'
            } catch (_) {}

            const { error: rpcError } = await supabase.rpc('register_link_click', {
              p_link_id: link.id,
              p_ip: clientIp,
            })

            // Fallback garantido se a RPC não existir
            if (rpcError) {
              await supabase.from('clicks').insert({ link_id: link.id, ip_address: clientIp })
              await supabase.rpc('incrementar_clique', { link_slug: cleanSlug })
            }
          } catch (e) {
            console.error('Falha ao registrar clique no cliente:', e)
            try {
              await supabase.from('clicks').insert({ link_id: link.id })
            } catch (_) {}
          }
        }

        // Redireciona para o destino
        window.location.replace(link.affiliate_url)
      } catch (err) {
        console.error('Erro geral no redirecionamento:', err)
        window.location.replace('/')
      }
    }

    processRedirect()
  }, [slug])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="space-y-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Redirecionando com segurança...</h2>
          <p className="text-muted-foreground animate-pulse">
            Você está sendo levado para a oferta na Shopee.
          </p>
        </div>
      </div>
    </div>
  )
}
