import { createFileRoute, redirect, notFound } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
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

export const Route = createFileRoute('/$slug')({
  loader: async ({ params }) => {
    const slug = String(params.slug ?? '').replace(/^\/+|\/+$/g, '')
    if (!slug || slug.includes('.')) {
      throw notFound()
    }

    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      const { data: destino, error } = await supabaseAdmin.rpc('incrementar_clique', {
        link_slug: slug,
      })

      if (!error && typeof destino === 'string' && destino) {
        return { targetUrl: destino }
      }

      const { data: link } = await supabaseAdmin
        .from('links')
        .select('affiliate_url')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (link?.affiliate_url) {
        return { targetUrl: link.affiliate_url }
      }
    } catch (e) {
      console.error('Erro ao carregar link no servidor:', e)
    }

    return { targetUrl: null }
  },
  component: RedirectPage,
})

function redirectToShopee(destinationUrl: string) {
  if (typeof window === 'undefined' || !destinationUrl) return

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (isMobile) {
    if (isAndroid) {
      // Intent Scheme nativo do Android para o app da Shopee
      const cleanUrl = destinationUrl.replace(/^https?:\/\//, '')
      const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.shopee.br;end;`
      window.location.href = intentUrl
    } else if (isIOS) {
      // Custom URL scheme para o app da Shopee no iOS
      const iosUrl = destinationUrl.replace(/^https?:\/\//, 'shopee://')
      window.location.href = iosUrl
    }

    // Fallback: se o app não estiver instalado, abre a URL web em 1.5s
    setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1500)
  } else {
    // Computador / Desktop
    window.location.replace(destinationUrl)
  }
}

function RedirectPage() {
  const loaderData = Route.useLoaderData()
  const targetUrl = loaderData?.targetUrl || null
  const { slug } = Route.useParams()
  const hasExecuted = useRef(false)
  const [destUrl, setDestUrl] = useState<string>(targetUrl || '')

  useEffect(() => {
    // Remove qualquer elemento ou badge do Lovable do DOM
    const removeLovableBadges = () => {
      document
        .querySelectorAll(
          '#lovable-badge, aside#lovable-badge, [id*="lovable"], [class*="lovable"], [data-lovable], a[href*="lovable.app"], a[href*="lovable.dev"], iframe[src*="lovable"]'
        )
        .forEach((el) => {
          try {
            el.remove()
          } catch (_) {}
        })
    }

    removeLovableBadges()
    const observer = new MutationObserver(removeLovableBadges)
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true })
    }

    if (hasExecuted.current) return
    hasExecuted.current = true // Trava estrita de execução única

    // Se o loader no servidor já obteve o destino com clique somado:
    if (targetUrl) {
      setDestUrl(targetUrl)
      redirectToShopee(targetUrl)
      return
    }

    // Fallback no cliente se necessário
    const cleanSlug = String(slug ?? '').replace(/^\/+|\/+$/g, '')
    if (!cleanSlug || cleanSlug.includes('.')) {
      window.location.replace('/')
      return
    }

    supabase
      .from('links')
      .select('affiliate_url')
      .eq('slug', cleanSlug)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data: link }) => {
        if (link?.affiliate_url) {
          setDestUrl(link.affiliate_url)
          redirectToShopee(link.affiliate_url)
        } else {
          window.location.replace('/')
        }
      })
      .catch(() => {
        window.location.replace('/')
      })

    return () => {
      observer.disconnect()
    }
  }, [targetUrl, slug])

  return (
    <div className="fixed inset-0 z-[99999] flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="max-w-xs w-full space-y-6">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#EE4D2D] border-t-transparent mx-auto"></div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Abrindo no App Shopee...</h2>
          <p className="text-xs text-muted-foreground">Você está sendo redirecionado para a oferta.</p>
        </div>
        {destUrl && (
          <button
            onClick={() => redirectToShopee(destUrl)}
            className="w-full py-3 px-4 rounded-xl bg-[#EE4D2D] hover:bg-[#d43f20] text-white font-semibold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Toque aqui para abrir no App
          </button>
        )}
      </div>
    </div>
  )
}
