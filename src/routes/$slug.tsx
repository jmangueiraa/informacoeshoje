import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

function isBotOrPrefetchRequest(request?: Request): boolean {
  if (!request) return false

  const userAgent = (request.headers.get('user-agent') || '').toLowerCase()
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

  const botPatterns = [
    'bot',
    'crawler',
    'spider',
    'facebookexternalhit',
    'whatsapp',
    'telegrambot',
    'twitterbot',
    'discordbot',
    'applebot',
    'googlebot',
    'bingbot',
    'slurp',
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
    'curl',
    'wget',
    'python-requests',
    'headlesschrome',
    'lighthouse',
  ]

  return botPatterns.some((pattern) => userAgent.includes(pattern))
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

        // Se for bot, crawler ou requisição de prefetch (ex: WhatsApp Web, Facebook Preview),
        // redireciona SEM incrementar o contador de cliques.
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

        // Para usuários humanos reais: incrementa clique e redireciona
        const { data: destino, error } = await supabaseAdmin.rpc('incrementar_clique', {
          link_slug: slug,
        })

        if (!error && typeof destino === 'string' && destino) {
          return new Response(null, {
            status: 302,
            headers: { Location: destino, 'Cache-Control': 'no-store' },
          })
        }

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
        const { data: destino, error } = await supabase.rpc('incrementar_clique', {
          link_slug: cleanSlug,
        })

        if (!error && typeof destino === 'string' && destino) {
          window.location.replace(destino)
          return
        }
      } catch (err) {
        console.error('Erro ao incrementar clique via RPC:', err)
      }

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
