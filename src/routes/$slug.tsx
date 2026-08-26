import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$slug')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = String(params.slug ?? '').replace(/^\/+|\/+$/g, '')
        if (!slug || slug.includes('.')) {
          return new Response('Not found', { status: 404 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
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
