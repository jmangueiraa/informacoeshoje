import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeContactPhone } from "./phone";

const createLinkSchema = z.object({
  affiliateUrl: z.string().url().refine(url => url.includes('shopee.com.br') || url.includes('shope.ee'), {
    message: "Apenas links da Shopee são permitidos"
  }),
  slug: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Slug deve conter apenas letras, números, hífens e underlines"
  }),
  title: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  domainId: z.string().optional().nullable(),
});

export const checkSlugAvailability = createServerFn({ method: "GET" })
  .inputValidator((slug: unknown) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    const cleanSlug = String(slug ?? '').replace(/^\/+|\/+$/g, '').trim().toLowerCase();
    const { data, error } = await supabase
      .from("links")
      .select("id")
      .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug}`)
      .maybeSingle();

    if (error) throw error;
    return !data;
  });

export const createCustomLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createLinkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    console.log("Criando link para usuário:", userId);

    const cleanSlug = String(data.slug ?? '').replace(/^\/+|\/+$/g, '').trim().toLowerCase();

    const isUUID = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let domainId: string | null = null;
    let customDomain: string | null = 'links.editaveisdocanva.com.br';

    if (data.domainId) {
      if (isUUID(data.domainId)) {
        domainId = data.domainId;
        customDomain = null;
      } else if (data.domainId === 'canva-links' || data.domainId === 'links.editaveisdocanva.com.br') {
        customDomain = 'links.editaveisdocanva.com.br';
        domainId = null;
      } else if (data.domainId === 'canva-arquivos' || data.domainId.includes('arquivos')) {
        customDomain = 'www.editaveisdocanva.com.br/arquivos';
        domainId = null;
      } else {
        customDomain = data.domainId;
        domainId = null;
      }
    }

    const insertData = {
      user_id: userId,
      slug: cleanSlug,
      affiliate_url: data.affiliateUrl,
      title: data.title || null,
      expires_at: data.expiresAt || null,
      domain_id: domainId,
      custom_domain: customDomain,
      status: 'active',
      clicks_count: 0
    };

    console.log("Dados de inserção:", insertData);

    const { data: link, error } = await authenticatedSupabase
      .from("links")
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      console.error("Erro na inserção do link:", error);
      if (error.code === '23505') throw new Error("Este slug já está em uso.");
      throw error;
    }

    return link;
  });

export const getUserLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // 1. Busca os links do usuário
    const { data: links, error } = await authenticatedSupabase
      .from("links")
      .select("*")
      .eq("user_id", userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!links || links.length === 0) return [];

    const linkIds = links.map((l) => l.id);

    // 2. Busca a contagem real agrupada por link_id na tabela clicks
    const { data: clicksData } = await authenticatedSupabase
      .from("clicks")
      .select("link_id")
      .in("link_id", linkIds);

    // 3. Mapeia a contagem de cliques para cada link individualmente
    const clickCounts: Record<string, number> = {};
    (clicksData || []).forEach((c: any) => {
      if (c.link_id) {
        clickCounts[c.link_id] = (clickCounts[c.link_id] || 0) + 1;
      }
    });

    return links.map((link) => {
      const counted = clickCounts[link.id];
      const count = counted !== undefined ? counted : (link.clicks_count ?? (link as any).clicks ?? 0);
      return {
        ...link,
        clicks_count: count,
        clicks: count,
      };
    });
  });

export const deleteLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { error } = await authenticatedSupabase
      .from("links")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
  });

export const toggleLinkStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string(), status: z.enum(['active', 'inactive']) }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { error } = await authenticatedSupabase
      .from("links")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
  });

export const resetLinkClicks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verifica se o link pertence ao usuário autenticado por segurança
    const { data: link, error: linkError } = await supabaseAdmin
      .from("links")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (linkError || !link) {
      throw new Error("Link não encontrado ou sem permissão.");
    }

    // 2. Zera o contador na tabela links
    await supabaseAdmin
      .from("links")
      .update({ clicks_count: 0 } as any)
      .eq("id", id);

    // 3. Remove registros do histórico de cliques (com service_role)
    await supabaseAdmin
      .from("clicks")
      .delete()
      .eq("link_id", id);

    return { success: true };
  });

export const getUserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase, claims } = context;
    const userEmail = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    const isMasterAdmin = userEmail === 'ajpentretedimento@hotmail.com';

    const { data: profile } = await authenticatedSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const defaultExp = isMasterAdmin 
        ? new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString()
        : (claims.user_metadata?.subscription_expires_at || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString());

      const initialProfile = {
        id: userId,
        full_name: (claims.user_metadata as any)?.full_name || userEmail.split('@')[0] || 'Usuário',
        username: userEmail,
        phone_number: (claims.user_metadata as any)?.phone_number || (claims.user_metadata as any)?.phone || null,
        subscription_type: isMasterAdmin ? 'lifetime' : ((claims.user_metadata as any)?.subscription_type || 'trial_7d'),
        subscription_price: isMasterAdmin ? 0.00 : (Number((claims.user_metadata as any)?.subscription_price) || 30.00),
        subscription_status: isMasterAdmin ? 'active' : ((claims.user_metadata as any)?.subscription_status || 'trial'),
        subscription_expires_at: defaultExp,
        trial_expires_at: defaultExp,
        is_trial: isMasterAdmin ? false : ((claims.user_metadata as any)?.is_trial !== false),
        updated_at: new Date().toISOString(),
      };

      try {
        await authenticatedSupabase.from("profiles").upsert(initialProfile, { onConflict: 'id' });
      } catch (_) {}
      return initialProfile;
    }

    return profile;
  });

export const updateProfileDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ domain: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // 1. Atualizar o domínio no perfil
    const { error: profileError } = await authenticatedSupabase
      .from("profiles")
      .update({ custom_domain: data.domain })
      .eq("id", userId);

    if (profileError) return { error: profileError.message };

    // 2. Registrar na tabela de domínios para o redirect engine
    const { error: domainError } = await authenticatedSupabase
      .from("user_domains")
      .upsert({ 
        user_id: userId, 
        domain: data.domain,
        is_verified: true
      }, { onConflict: 'domain' });

    if (domainError) return { error: domainError.message };

    return { success: true };
  });

export const updateProfileSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    shopee_app_id: z.string().optional(),
    shopee_app_secret: z.string().optional(),
    shopee_api_key: z.string().optional(),
    full_name: z.string().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // Remove undefined values to satisfy strict types if necessary
    const updateData: any = {};
    if (data.shopee_app_id !== undefined) updateData.shopee_app_id = data.shopee_app_id;
    if (data.shopee_app_secret !== undefined) updateData.shopee_app_secret = data.shopee_app_secret;
    if (data.shopee_api_key !== undefined) updateData.shopee_api_key = data.shopee_api_key;
    if (data.full_name !== undefined) updateData.full_name = data.full_name;

    const { error } = await authenticatedSupabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) return { error: error.message };
    return { success: true };
  });

export const createTrackingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    name: z.string(),
    phone: z.string(),
    affiliateUrl: z.string().url(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const nomeLimpo = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const cleanPhone = normalizeContactPhone(data.phone);
    const lastDigits = cleanPhone.slice(-4);
    const slug = `rastreio-${nomeLimpo}-${lastDigits}`;

    const insertData = {
      user_id: userId,
      slug,
      affiliate_url: data.affiliateUrl,
      title: `Rastreio - ${data.name} (${data.phone})`,
      status: 'active',
      clicks_count: 0
    };

    const { data: link, error } = await authenticatedSupabase
      .from("links")
      .upsert(insertData as any, { onConflict: 'slug' })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar link de rastreio:", error);
      throw error;
    }

    return link;
  });

/**
 * Garante um link de rastreio para um contato, gerando slug a partir do primeiro nome.
 * Reutiliza o link existente do mesmo contato (mesmo telefone) e aplica sufixo numérico
 * quando o slug já pertence a outro contato.
 */
export const ensureTrackingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    name: z.string(),
    phone: z.string(),
    affiliateUrl: z.string().url(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: db } = context;

    const cleanPhone = normalizeContactPhone(data.phone);
    const firstName = (data.name.trim().split(/\s+/)[0] || "cliente")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    const base = firstName.length >= 2 ? firstName : "cliente";

    // 1. Reutiliza link já existente para este contato (telefone no título)
    const { data: existing } = await db
      .from("links")
      .select("id, slug, affiliate_url")
      .eq("user_id", userId)
      .like("title", `%${cleanPhone}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    const found = existing?.[0];
    if (found) {
      if (found.affiliate_url !== data.affiliateUrl) {
        await db.from("links").update({ affiliate_url: data.affiliateUrl }).eq("id", found.id);
      }
      return { slug: found.slug, reused: true };
    }

    // 2. Encontra slug livre (base, base-1, base-2 ...)
    const { data: taken } = await db
      .from("links")
      .select("slug")
      .or(`slug.eq.${base},slug.like.${base}-%`);

    const takenSet = new Set((taken || []).map((l: any) => l.slug));
    let slug = base;
    let i = 1;
    while (takenSet.has(slug)) {
      slug = `${base}-${i}`;
      i++;
    }

    const { data: link, error } = await db
      .from("links")
      .insert({
        user_id: userId,
        slug,
        affiliate_url: data.affiliateUrl,
        title: `Rastreio - ${data.name} (${cleanPhone})`,
        status: "active",
        clicks_count: 0,
      } as any)
      .select("slug")
      .single();

    if (error) {
      console.error("Erro ao garantir link de rastreio:", error);
      throw error;
    }

    return { slug: link.slug, reused: false };
  });

const trackShopeeClickSchema = z.object({
  slug: z.string().min(1).max(250),
});

function isBotUserAgent(userAgent: string, prefetchHeader?: string | null): boolean {
  if (prefetchHeader && prefetchHeader.toLowerCase().includes('prefetch')) {
    return true;
  }
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  const botKeywords = [
    'googlebot',
    'bingbot',
    'yandex',
    'baiduspider',
    'facebookexternalhit',
    'facebot',
    'whatsapp',
    'twitterbot',
    'telegrambot',
    'applebot',
    'discordbot',
    'pinterest',
    'linkedinbot',
    'slackbot',
    'skypeuripreview',
    'petalbot',
    'bytespider',
    'semrushbot',
    'ahrefsbot',
    'mj12bot',
    'dotbot',
    'headlesschrome',
    'phantomjs',
    'curl',
    'wget',
    'python-requests',
    'axios',
    'got',
    'node-fetch',
    'postmanruntime',
    'lighthouse',
    'gtmetrix',
    'google-read-aloud',
    'feedfetcher-google',
    'mediapartners-google',
    'adsbot-google',
    'spider',
    'crawler',
  ];
  return botKeywords.some((keyword) => ua.includes(keyword));
}

/**
 * Backend de Rastreamento com Janela de Atribuição da Shopee (7 dias).
 * Validação dupla: Cookies de Navegador (shopee_click_cooldown) + Registro de IP no Supabase (ip_cooldown).
 */
export const trackShopeeClick = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trackShopeeClickSchema.parse(data))
  .handler(async ({ data }) => {
    const rawSlug = String(data.slug ?? '').trim();
    const cleanSlug = rawSlug.replace(/^\/+|\/+$/g, '').toLowerCase();

    const { getCookie, setCookie, getRequestHeader, getRequestIP, setResponseHeader } = await import("@tanstack/react-start/server");

    // 0. Detecção de Robôs, Crawlers, Links Previews (WhatsApp, Google, Facebook) e Prefetches
    const userAgent = getRequestHeader('user-agent') || '';
    const prefetchHeader = getRequestHeader('purpose') || getRequestHeader('sec-purpose') || getRequestHeader('x-purpose');
    const isBot = isBotUserAgent(userAgent, prefetchHeader);

    // 1. Checagem 1 (Navegador/Cookie):
    // Verifica se existe o cookie shopee_click_cooldown
    let hasCookie = false;
    try {
      const rawCookie = getCookie('shopee_click_cooldown');
      hasCookie = rawCookie === 'true' || rawCookie === '1' || Boolean(rawCookie);
    } catch (e) {
      console.warn("Aviso ao ler cookie shopee_click_cooldown:", e);
    }

    // 2. Checagem 2 (Extração do IP da requisição):
    let clientIp = 'visitor';
    try {
      const forwardedFor = getRequestHeader('x-forwarded-for');
      const realIp = getRequestHeader('x-real-ip');
      const cfConnectingIp = getRequestHeader('cf-connecting-ip');
      const h3Ip = getRequestIP({ xForwardedFor: true });

      const extracted = (forwardedFor ? forwardedFor.split(',')[0].trim() : '') || realIp || cfConnectingIp || h3Ip;
      if (extracted && extracted !== '::1' && extracted !== '127.0.0.1') {
        clientIp = extracted;
      }
    } catch (e) {
      console.warn("Aviso ao extrair IP do cliente:", e);
    }

    // 3. Execução com Fallbacks em Cascata (Garantia de Redirecionamento 100% Funcional)
    let destinationUrl: string | null = null;
    let isValidClick = false;
    let inCooldown = hasCookie;

    // Tentativa 1: RPC process_shopee_click
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('process_shopee_click', {
        p_slug: cleanSlug,
        p_ip: clientIp,
        p_has_cookie: hasCookie,
        p_is_bot: isBot,
      });

      if (!rpcError && rpcResult && (rpcResult as any).destination_url) {
        destinationUrl = (rpcResult as any).destination_url;
        isValidClick = Boolean((rpcResult as any).is_valid_click);
        inCooldown = Boolean((rpcResult as any).in_cooldown || hasCookie);
      } else if (rpcError) {
        console.warn("Aviso na RPC process_shopee_click (usando fallback):", rpcError);
      }
    } catch (rpcEx) {
      console.warn("Exceção na RPC process_shopee_click:", rpcEx);
    }

    // Tentativa 2: Consulta direta com supabaseAdmin
    if (!destinationUrl) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: link } = await supabaseAdmin
          .from("links")
          .select("*")
          .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug},slug.ilike.arquivos/${cleanSlug},slug.ilike./arquivos/${cleanSlug}`)
          .maybeSingle();

        if (link) {
          destinationUrl = (link as any)?.affiliate_url || (link as any)?.destination_url || (link as any)?.url_destino || null;

          if (!hasCookie && !isBot && destinationUrl) {
            isValidClick = true;
            try {
              await Promise.allSettled([
                supabaseAdmin.from("links").update({ clicks_count: ((link as any).clicks_count || 0) + 1 }).eq("id", link.id),
                supabaseAdmin.from("clicks").insert({ link_id: link.id, ip_address: clientIp, slug: cleanSlug }),
                supabaseAdmin.from("link_clicks").insert({ link_id: link.id, ip_address: clientIp }),
                supabaseAdmin.from("ip_cooldown" as any).upsert({ ip_address: clientIp, last_click_at: new Date().toISOString(), slug: cleanSlug, link_id: link.id }),
              ]);
            } catch (_) {}
          }
        }
      } catch (dbEx) {
        console.warn("Exceção no fallback supabaseAdmin:", dbEx);
      }
    }

    // Tentativa 3: Consulta com cliente padrão Supabase
    if (!destinationUrl) {
      try {
        const { data: link } = await supabase
          .from("links")
          .select("*")
          .or(`slug.ilike.${cleanSlug},slug.ilike./${cleanSlug},slug.ilike.arquivos/${cleanSlug},slug.ilike./arquivos/${cleanSlug}`)
          .maybeSingle();

        if (link) {
          destinationUrl = (link as any)?.affiliate_url || (link as any)?.destination_url || (link as any)?.url_destino || null;
        }
      } catch (_) {}
    }

    // Garante protocolo https:// completo se o link foi salvo sem protocolo
    if (destinationUrl) {
      destinationUrl = destinationUrl.trim();
      if (!/^https?:\/\//i.test(destinationUrl)) {
        destinationUrl = `https://${destinationUrl}`;
      }
    }

    // 4. Injeção do Cookie de 7 dias (se não for bot e não tinha cookie)
    if (!hasCookie && !isBot) {
      try {
        setCookie('shopee_click_cooldown', 'true', {
          maxAge: 604800, // 7 dias
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        setResponseHeader(
          'Set-Cookie',
          'shopee_click_cooldown=true; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax'
        );
      } catch (cookieErr) {
        console.warn("Aviso ao injetar cookie de cooldown:", cookieErr);
      }
    }

    return {
      destinationUrl,
      isValidClick,
      inCooldown,
      isBot,
      success: Boolean(destinationUrl),
    };
  });

export const clearIpCooldownList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from('ip_cooldown' as any).delete().neq('ip_address', 'dummy_value_to_delete_all');
    if (error) {
      await supabaseAdmin.rpc('clear_all_ip_cooldown' as any);
    }
    return { success: true };
  });