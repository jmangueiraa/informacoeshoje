import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { registerClick } from '@/lib/analytics.functions'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/$slug')({
  component: RedirectPage,
})

function RedirectPage() {
  const { slug } = Route.useParams()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<number | null>(null)

  useEffect(() => {
    const performRedirect = async () => {
      if (!slug) return
      const slugLimpo = slug.replace(/^\/+|\/+$/g, '')

      // 1) Registra o clique (analytics completo) sem travar o redirecionamento
      const analytics = registerClick({
        data: {
          slug: slugLimpo,
          host: window.location.host,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
        },
      }).catch((err) => {
        console.error('Erro no analytics do clique:', err)
        return null
      })

      // 2) Incremento seguro direto no banco (funciona para visitantes anônimos)
      try {
        const { data: urlDestino, error: rpcError } = await supabase.rpc('incrementar_clique', {
          link_slug: slugLimpo,
        })
        if (rpcError) throw rpcError
        if (urlDestino) {
          window.location.replace(urlDestino as string)
          return
        }
      } catch (err) {
        console.error('Erro ao registrar clique:', err)
      }

      // 3) Fallback: usa o resultado do analytics ou busca direta
      const result = await analytics
      if (result?.url) {
        window.location.replace(result.url)
        return
      }

      const { data: link } = await supabase
        .from('links')
        .select('affiliate_url')
        .eq('slug', slugLimpo)
        .eq('status', 'active')
        .maybeSingle()

      if (link?.affiliate_url) {
        window.location.replace(link.affiliate_url)
        return
      }

      setError(result?.error ?? 'Link não encontrado')
      setStatus(result?.status ?? 404)
    }

    performRedirect()
  }, [slug])


  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {status === 404 ? "Link não encontrado" : "Link indisponível"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {error}
          </p>
          <div className="pt-6">
            <a 
              href="https://shopee.com.br" 
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ir para Shopee
            </a>
          </div>
        </div>
      </div>
    )
  }

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
