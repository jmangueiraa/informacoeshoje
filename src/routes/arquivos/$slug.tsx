import { createFileRoute, redirect, notFound, isRedirect } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/arquivos/$slug')({
  loader: async ({ params }) => {
    const rawSlug = String(params.slug ?? '').trim()
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '')
    if (!cleanSlug || cleanSlug.includes('.')) {
      throw notFound()
    }

    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

      // 1. Tenta incrementar via RPC
      const { data: destino, error: rpcError } = await supabaseAdmin.rpc('incrementar_clique', {
        link_slug: cleanSlug,
      })

      let targetUrl: string | null = null
      if (!rpcError && typeof destino === 'string' && destino) {
        targetUrl = destino
      } else {
        const { data: link, error: linkError } = await supabaseAdmin
          .from('links')
          .select('*')
          .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug},slug.ilike.arquivos/${cleanSlug},slug.ilike./arquivos/${cleanSlug}`)
          .maybeSingle()

        targetUrl = (link as any)?.affiliate_url || (link as any)?.destination_url || (link as any)?.url_destino
        if (!linkError && targetUrl && link?.id) {
          try {
            await supabaseAdmin.from('clicks').insert({ link_id: link.id })
            await supabaseAdmin
              .from('links')
              .update({ clicks_count: (link.clicks_count || 0) + 1 })
              .eq('id', link.id)
          } catch (_) {}
        }
      }

      // 2. Realiza o redirecionamento HTTP real 302 no backend
      if (targetUrl) {
        throw redirect({
          href: targetUrl,
          statusCode: 302,
        })
      }
    } catch (e) {
      if (isRedirect(e)) {
        throw e
      }
      console.warn('Erro no loader server-side de /arquivos:', e)
    }

    return { targetUrl: null }
  },
  component: ArquivosRedirectHandlerPage,
})

function ArquivosRedirectHandlerPage() {
  const { slug } = Route.useParams()
  const hasExecuted = useRef(false)

  useEffect(() => {
    if (hasExecuted.current) return
    hasExecuted.current = true

    const rawSlug = String(slug ?? '').trim()
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '')
    if (!cleanSlug || cleanSlug.includes('.')) {
      window.location.replace('/')
      return
    }

    // Redirecionamento real via window.location.replace no frontend
    supabase
      .from('links')
      .select('*')
      .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug},slug.ilike.arquivos/${cleanSlug},slug.ilike./arquivos/${cleanSlug}`)
      .maybeSingle()
      .then(({ data: link, error }) => {
        if (error || !link) {
          console.error('Link não encontrado sob /arquivos:', error)
          window.location.replace('/')
          return
        }

        const dest = (link as any)?.affiliate_url || (link as any)?.destination_url || (link as any)?.url_destino
        if (dest) {
          try {
            supabase.from('clicks').insert({ link_id: link.id })
            supabase
              .from('links')
              .update({ clicks_count: (link.clicks_count || 0) + 1 })
              .eq('id', link.id)
          } catch (_) {}

          // Redirecionamento real de navegador
          window.location.replace(dest)
        } else {
          window.location.replace('/')
        }
      })
      .catch((err) => {
        console.error('Exceção ao processar redirecionamento (/arquivos):', err)
        window.location.replace('/')
      })
  }, [slug])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
      <p style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#666666', fontSize: '14px' }}>
        Redirecionando para o produto...
      </p>
    </div>
  )
}
