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

function handleMobileRedirect(destinationUrl: string) {
  if (typeof window === 'undefined' || !destinationUrl) return

  const isAndroid = /Android/i.test(navigator.userAgent)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

  if (isAndroid) {
    // 1. URL scheme nativo da Shopee BR para rotas e links web
    const appDeepLink = `shopee://open?url=${encodeURIComponent(destinationUrl)}`

    // 2. Intent oficial do pacote com fallback
    const cleanUrl = destinationUrl.replace(/^https?:\/\//, '')
    const androidIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.shopee.br;S.browser_fallback_url=${encodeURIComponent(destinationUrl)};end;`

    // Tenta primeiro o deep link direto
    window.location.href = appDeepLink

    // Se em 300ms o app não assumir, dispara o Intent nativo do Android
    setTimeout(() => {
      window.location.href = androidIntent
    }, 300)
    return
  }

  if (isIOS) {
    // No iOS, o deep link direto com a URL encoded força o app
    const iosDeepLink = `shopee://open?url=${encodeURIComponent(destinationUrl)}`
    window.location.href = iosDeepLink

    // Fallback para Safari se o app não estiver instalado
    setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1200)
    return
  }

  // Desktop
  window.location.replace(destinationUrl)
}

function RedirectPage() {
  const loaderData = Route.useLoaderData()
  const targetUrl = loaderData?.targetUrl || null
  const { slug } = Route.useParams()
  const hasExecuted = useRef(false)

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
      handleMobileRedirect(targetUrl)
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
          handleMobileRedirect(link.affiliate_url)
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

  // Retorna tela em branco limpa durante a fração de segundo da requisição
  return null
}
