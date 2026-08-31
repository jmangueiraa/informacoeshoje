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
        const isBot = isBotOrPrefetchRequest(request)

        // Se for bot/crawler/preview, redireciona SEM incrementar
        if (isBot) {
          const { data: link } = await supabaseAdmin
            .from('links')
            .select('affiliate_url')
            .eq('slug', slug)
            .eq('status', 'active')
            .maybeSingle()

          if (link?.affiliate_url) {
            return new Response(null, {
              status: 302,
              headers: { Location: link.affiliate_url, 'Cache-Control': 'no-store' },
            })
          }
          return new Response('Link não encontrado', { status: 404 })
        }

        // Para usuário humano: incrementa exatamente 1 clique via RPC única
        const { data: destino, error } = await supabaseAdmin.rpc('incrementar_clique', {
          link_slug: slug,
        })

        if (!error && typeof destino === 'string' && destino) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: destino,
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          })
        }

        // Fallback: se a RPC falhar, busca o link e adiciona exatamente 1 clique
        const { data: link } = await supabaseAdmin
          .from('links')
          .select('id, affiliate_url, clicks_count')
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle()

        if (link?.affiliate_url) {
          await supabaseAdmin.from('clicks').insert({ link_id: link.id })
          await supabaseAdmin
            .from('links')
            .update({ clicks_count: (link.clicks_count || 0) + 1 })
            .eq('id', link.id)

          return new Response(null, {
            status: 302,
            headers: {
              Location: link.affiliate_url,
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          })
        }

        return new Response('Link não encontrado', { status: 404 })
      },
    },
  },
  component: RedirectPage,
})

function RedirectPage() {
  const { slug } = Route.useParams()
  const hasExecuted = useRef(false)

  useEffect(() => {
    if (!slug || hasExecuted.current) return
    hasExecuted.current = true // Trava estrita para executar exatamente 1 vez no cliente

    const processRedirect = async () => {
      const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '')
      if (!cleanSlug || cleanSlug.includes('.')) return

      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
      const isBot = BOT_USER_AGENTS.some((bot) => userAgent.includes(bot.toLowerCase()))

      if (!isBot) {
        try {
          // Incrementa exatamente 1 vez
          const { data: destino, error } = await supabase.rpc('incrementar_clique', {
            link_slug: cleanSlug,
          })

          if (!error && typeof destino === 'string' && destino) {
            window.location.replace(destino)
            return
          }
        } catch (err) {
          console.error('Erro ao incrementar clique no cliente:', err)
        }
      }

      // Fallback simples caso a RPC falhe
      try {
        const { data: link } = await supabase
          .from('links')
          .select('affiliate_url')
          .eq('slug', cleanSlug)
          .eq('status', 'active')
          .maybeSingle()

        if (link?.affiliate_url) {
          window.location.replace(link.affiliate_url)
        } else {
          window.location.replace('/')
        }
      } catch (_) {
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
