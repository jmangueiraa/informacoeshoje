import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/arquivos/$slug')({
  component: ArquivosRedirectPage,
})

function executeSmartDeepLink(destinationUrl: string) {
  if (typeof window === 'undefined' || !destinationUrl) return

  const userAgent = navigator.userAgent || ''
  const isAndroid = /Android/i.test(userAgent)
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const isInApp = /FBAN|FBAV|Instagram|TikTok|BytedanceWebview/i.test(userAgent)

  // 1. Android (App Nativo ou Fallback Web)
  if (isAndroid) {
    const cleanUrl = destinationUrl.replace(/^https?:\/\//, '')

    // Se estiver no In-App Browser (Instagram/TikTok), abre no Chrome externo
    if (isInApp) {
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end;`
      return
    }

    const encodedUrl = encodeURIComponent(destinationUrl)
    const intentUrl = `intent://open?url=${encodedUrl}#Intent;scheme=shopee;package=com.shopee.br;S.browser_fallback_url=${encodedUrl};end;`

    const startTime = Date.now()
    const linkElem = document.createElement('a')
    linkElem.href = intentUrl
    linkElem.rel = 'noreferrer'
    document.body.appendChild(linkElem)
    linkElem.click()

    // Fallback inteligente em JavaScript: abre web se o app não estiver instalado
    setTimeout(() => {
      const elapsed = Date.now() - startTime
      // Se o usuário ainda estiver com a aba aberta e focada (app não abriu):
      if (!document.hidden && elapsed < 3000) {
        window.location.replace(destinationUrl)
      }
    }, 1200)
    return
  }

  // 2. iOS (iPhone / iPad)
  if (isIOS) {
    const appUrl = `shopee://open?url=${encodeURIComponent(destinationUrl)}`
    const startTime = Date.now()
    window.location.href = appUrl

    // Fallback inteligente no iOS
    setTimeout(() => {
      const elapsed = Date.now() - startTime
      if (!document.hidden && elapsed < 3000) {
        window.location.replace(destinationUrl)
      }
    }, 1000)
    return
  }

  // 3. Desktop / Computador (Navegador Web direto)
  window.location.replace(destinationUrl)
}

function ArquivosRedirectPage() {
  const { slug } = Route.useParams()
  const [statusText, setStatusText] = useState('Abrindo o aplicativo da Shopee...')

  useEffect(() => {
    const rawSlug = String(slug ?? '').trim()
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '')

    if (!cleanSlug || cleanSlug.includes('.')) {
      window.location.replace('/')
      return
    }

    async function processAndRedirect() {
      try {
        let destinationUrl: string | null = null

        // 1. Tenta incrementar e obter o destino atomicamente via RPC
        try {
          const { data: rpcDest, error: rpcError } = await supabase.rpc('incrementar_clique', {
            link_slug: cleanSlug,
          })
          if (!rpcError && typeof rpcDest === 'string' && rpcDest) {
            destinationUrl = rpcDest
          }
        } catch (e) {
          console.warn('Erro na RPC de clique (/arquivos):', e)
        }

        // 2. Fallback de busca no Supabase
        if (!destinationUrl) {
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

          destinationUrl = (link as any)?.affiliate_url || (link as any)?.destination_url || (link as any)?.url_destino
          if (!destinationUrl) {
            window.location.replace('/')
            return
          }

          // Registra clique no banco com await garantido
          try {
            await Promise.allSettled([
              supabase.rpc('increment_clicks', { row_id: link.id }),
              supabase.from('clicks').insert({ link_id: link.id }),
              supabase.from('link_clicks').insert({ link_id: link.id, ip_address: 'visitor' }),
            ])
          } catch (_) {}
        }

        // Dispara o Deep Link Inteligente com Fallback Web automático
        executeSmartDeepLink(destinationUrl)
      } catch (err) {
        console.error('Erro no processamento do clique (/arquivos):', err)
        window.location.replace('/')
      }
    }

    processAndRedirect()
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
