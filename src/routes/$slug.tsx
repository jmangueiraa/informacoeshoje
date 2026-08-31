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
          .select('id, affiliate_url, status, expires_at')
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle()

        if (!link?.affiliate_url) {
          return new Response('Link não encontrado', { status: 404 })
        }

        const isBot = isBotOrPrefetchRequest(request)

        // 2. Se for humano, registra o clique por IP com controle de 24h via RPC seguro
        if (!isBot) {
          try {
            const clientIp = getClientIp(request)
            await supabaseAdmin.rpc('register_link_click', {
              p_link_id: link.id,
              p_ip: clientIp,
            })
          } catch (trackError) {
            console.error('Erro ao registrar clique seguro:', trackError)
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
          .select('id, affiliate_url, status')
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

        // Se for humano, busca IP e registra clique no Supabase
        if (!isBot) {
          try {
            const ipRes = await fetch('https://api.ipify.org?format=json')
            const ipData = await ipRes.json()
            const clientIp = ipData.ip || 'unknown'

            await supabase.rpc('register_link_click', {
              p_link_id: link.id,
              p_ip: clientIp,
            })
          } catch (e) {
            console.error('Falha ao registrar IP do clique no cliente:', e)
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
