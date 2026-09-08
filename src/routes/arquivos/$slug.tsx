import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/arquivos/$slug')({
  component: ArquivosRedirectPage,
})

function autoRedirectToShopee(destinationUrl: string) {
  if (typeof window === 'undefined' || !destinationUrl) return

  const userAgent = navigator.userAgent || ''
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent)
  const isAndroid = /Android/i.test(userAgent)
  const isInApp = /FBAN|FBAV|Instagram|TikTok|BytedanceWebview/i.test(userAgent)

  if (isMobile) {
    const encodedUrl = encodeURIComponent(destinationUrl)
    const cleanUrl = destinationUrl.replace(/^https?:\/\//, '')

    // Se estiver no navegador embutido (Instagram/TikTok), escapa para o Chrome externo
    if (isInApp && isAndroid) {
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end;`
      return
    }

    // 1. Tenta abrir o app nativo da Shopee imediatamente
    if (isAndroid) {
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.shopee.br;S.browser_fallback_url=${encodedUrl};end;`
    } else {
      window.location.href = `shopee://open?url=${encodedUrl}`
    }

    // 2. Fallback de 1.5 segundo para a URL web caso o usuário continue na mesma página (app não instalado)
    const fallbackTimer = setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1500)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(fallbackTimer)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange, { once: true })
    window.addEventListener('pagehide', () => clearTimeout(fallbackTimer), { once: true })
    return
  }

  // Desktop / Computador: abre na Web imediatamente
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

        // 1. Incrementa clique e obtém o destino de forma atômica
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

        // Executa abertura automática no App Shopee com fallback web em 1.5s
        autoRedirectToShopee(destinationUrl)
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
