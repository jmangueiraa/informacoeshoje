import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/arquivos/$slug')({
  component: ArquivosRedirectPage,
})

function executeRedirect(destinationUrl: string) {
  if (typeof window === 'undefined' || !destinationUrl) return

  const userAgent = navigator.userAgent || ''
  const isAndroid = /Android/i.test(userAgent)
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const isInApp = /FBAN|FBAV|Instagram|TikTok|BytedanceWebview/i.test(userAgent)

  // Android: se estiver dentro de app (Instagram/TikTok), escapa para Chrome; senão dispara app Shopee
  if (isAndroid) {
    const cleanPath = destinationUrl.replace(/^https?:\/\//, '')
    if (isInApp) {
      window.location.href = `intent://${cleanPath}#Intent;scheme=https;package=com.android.chrome;end;`
      return
    }

    const intentShopee = `intent://${cleanPath}#Intent;scheme=https;package=com.shopee.br;S.browser_fallback_url=${encodeURIComponent(destinationUrl)};end;`
    const a = document.createElement('a')
    a.href = intentShopee
    a.rel = 'noreferrer'
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1200)
    return
  }

  // iOS: deep link nativo da Shopee
  if (isIOS) {
    window.location.href = `shopee://open?url=${encodeURIComponent(destinationUrl)}`
    setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1000)
    return
  }

  // Desktop / Navegador PC
  window.location.replace(destinationUrl)
}

function ArquivosRedirectPage() {
  const { slug } = Route.useParams()
  const [statusText, setStatusText] = useState('Redirecionando para o produto...')

  useEffect(() => {
    const rawSlug = String(slug ?? '').trim()
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '')

    if (!cleanSlug || cleanSlug.includes('.')) {
      window.location.replace('/')
      return
    }

    async function execute() {
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

        // Incrementa contagem de cliques
        try {
          supabase.from('clicks').insert({ link_id: link.id })
          supabase
            .from('links')
            .update({ clicks_count: (link.clicks_count || 0) + 1 })
            .eq('id', link.id)
        } catch (_) {}

        // Redirecionamento real
        executeRedirect(destinationUrl)
      } catch (err) {
        console.error('Erro no redirecionamento:', err)
        window.location.replace('/')
      }
    }

    execute()
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
