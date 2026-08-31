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

        // 2. Se não for bot, valida IP único nas últimas 24 horas antes de incrementar
        if (!isBot) {
          try {
            const clientIp = getClientIp(request)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

            // Verifica se o mesmo IP já clicou neste link nas últimas 24 horas
            const { data: existingClick } = await supabaseAdmin
              .from('link_clicks')
              .select('id')
              .eq('link_id', link.id)
              .eq('ip_address', clientIp)
              .gte('created_at', twentyFourHoursAgo)
              .maybeSingle()

            if (!existingClick) {
              // Registra o IP na tabela link_clicks
              await supabaseAdmin.from('link_clicks').insert({
                link_id: link.id,
                ip_address: clientIp,
              })

              // Registra na tabela clicks para gráficos
              await supabaseAdmin.from('clicks').insert({
                link_id: link.id,
                ip_address: clientIp,
              })

              // Incrementa atomicamente o contador
              await supabaseAdmin.rpc('increment_clicks', { row_id: link.id })
            }
          } catch (trackError) {
            console.error('Erro ao registrar clique seguro:', trackError)
          }
        }

        // Redireciona imediatamente para a URL de afiliado
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
        const { data: link } = await supabase
          .from('links')
          .select('id, affiliate_url, clicks_count')
          .eq('slug', cleanSlug)
          .eq('status', 'active')
          .maybeSingle()

        if (link?.affiliate_url) {
          window.location.replace(link.affiliate_url)
        }
      } catch (err) {
        console.error('Erro ao redirecionar link:', err)
      }
    }

    processRedirect()
  }, [slug])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="space-y-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Redirecionando...</h2>
          <p className="text-muted-foreground animate-pulse">
            Você está sendo levado para a oferta na Shopee.
          </p>
        </div>
      </div>
    </div>
  )
}
