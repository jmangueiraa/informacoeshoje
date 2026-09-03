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

      if (!rpcError && typeof destino === 'string' && destino) {
        return { targetUrl: destino }
      }

      // 2. Busca com ilike (case-insensitive) ignorando barras e maiúsculas/minúsculas
      const { data: link, error: linkError } = await supabaseAdmin
        .from('links')
        .select('id, affiliate_url, status, clicks_count, expires_at')
        .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug}`)
        .or('status.eq.active,status.is.null')
        .maybeSingle()

      if (!linkError && link?.affiliate_url) {
        // Incrementa o contador de cliques
        try {
          await supabaseAdmin.from('clicks').insert({ link_id: link.id })
          await supabaseAdmin
            .from('links')
            .update({ clicks_count: (link.clicks_count || 0) + 1 })
            .eq('id', link.id)
        } catch (_) {}

        return { targetUrl: link.affiliate_url }
      }
    } catch (e) {
      console.error('Erro ao carregar link no servidor:', e)
    }

    return { targetUrl: null }
  },
  component: RedirectPage,
})

function executeRedirect(destinationUrl: string) {
  if (typeof window === 'undefined' || !destinationUrl) return

  const userAgent = navigator.userAgent || ''
  const isAndroid = /Android/i.test(userAgent)
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent)
  const isInApp = /FBAN|FBAV|Instagram|TikTok|BytedanceWebview/i.test(userAgent)

  // --- BYPASS PARA ANDROID ---
  if (isAndroid) {
    const cleanPath = destinationUrl.replace(/^https?:\/\//, '')

    // Se estiver preso dentro do In-App Browser (Instagram/TikTok/Facebook), escapa para o Chrome externo
    if (isInApp) {
      window.location.href = `intent://${cleanPath}#Intent;scheme=https;package=com.android.chrome;end;`
      return
    }

    // Se estiver no navegador padrão (Chrome/WhatsApp), aciona direto o app da Shopee
    const intentShopee = `intent://${cleanPath}#Intent;scheme=https;package=com.shopee.br;S.browser_fallback_url=${encodeURIComponent(destinationUrl)};end;`

    const a = document.createElement('a')
    a.href = intentShopee
    a.rel = 'noreferrer'
    document.body.appendChild(a)
    a.click()

    setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1500)
    return
  }

  // --- BYPASS PARA IOS (IPHONE) ---
  if (isIOS) {
    window.location.href = `shopee://open?url=${encodeURIComponent(destinationUrl)}`
    setTimeout(() => {
      window.location.replace(destinationUrl)
    }, 1200)
    return
  }

  // Desktop / Navegador de PC
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
      executeRedirect(targetUrl)
      return
    }

    // Fallback no cliente: busca com ilike (case-insensitive)
    const cleanSlug = String(slug ?? '').trim().replace(/^\/+|\/+$/g, '')
    if (!cleanSlug || cleanSlug.includes('.')) {
      window.location.replace('/')
      return
    }

    supabase
      .from('links')
      .select('id, affiliate_url, status, clicks_count')
      .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug}`)
      .or('status.eq.active,status.is.null')
      .maybeSingle()
      .then(({ data: link }) => {
        if (link?.affiliate_url) {
          // Incrementa métrica
          try {
            supabase.from('clicks').insert({ link_id: link.id })
            supabase
              .from('links')
              .update({ clicks_count: (link.clicks_count || 0) + 1 })
              .eq('id', link.id)
          } catch (_) {}

          executeRedirect(link.affiliate_url)
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
