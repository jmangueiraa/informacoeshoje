import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/$slug')({
  component: SlugRedirectPage,
})

function SlugRedirectPage() {
  const { slug } = Route.useParams()
  const [statusText, setStatusText] = useState('Redirecionando para o produto...')

  useEffect(() => {
    const rawSlug = String(slug ?? '').trim()
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '')

    if (!cleanSlug || cleanSlug.includes('.')) {
      window.location.replace('/')
      return
    }

    async function executeRedirect() {
      try {
        const { data: link, error } = await supabase
          .from('links')
          .select('*')
          .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug},slug.ilike.arquivos/${cleanSlug},slug.ilike./arquivos/${cleanSlug}`)
          .maybeSingle()

        if (error || !link) {
          console.error('Link não localizado no Supabase:', error)
          setStatusText('Link não encontrado. Redirecionando...')
          setTimeout(() => {
            window.location.replace('/')
          }, 800)
          return
        }

        const destinationUrl = (link as any)?.affiliate_url || (link as any)?.destination_url || (link as any)?.url_destino
        if (!destinationUrl) {
          window.location.replace('/')
          return
        }

        // Incrementa contagem de cliques no banco
        try {
          supabase.from('clicks').insert({ link_id: link.id })
          supabase
            .from('links')
            .update({ clicks_count: (link.clicks_count || 0) + 1 })
            .eq('id', link.id)
        } catch (_) {}

        // Executa redirecionamento real de navegador
        window.location.replace(destinationUrl)
      } catch (err) {
        console.error('Erro no redirecionamento:', err)
        window.location.replace('/')
      }
    }

    executeRedirect()
  }, [slug])

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '36px 28px',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          textAlign: 'center',
          maxWidth: '380px',
          width: '90%',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '4px solid #ee4d2d',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 20px auto',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#222222', margin: '0 0 8px 0' }}>
          {statusText}
        </h2>
        <p style={{ fontSize: '13px', color: '#888888', margin: 0 }}>
          Aguarde um momento...
        </p>
      </div>
    </div>
  )
}
