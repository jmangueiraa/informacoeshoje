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
    const { data, error } = await supabase
      .from("links")
      .select("id")
      .eq("slug", slug)
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

    // Lógica de limites removida para conta única unificada
    // Todos os usuários têm acesso total

    const insertData = {
      user_id: userId,
      slug: data.slug,
      affiliate_url: data.affiliateUrl,
      title: data.title || null,
      expires_at: data.expiresAt || null,
      domain_id: data.domainId || null,
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
    const { userId, supabase: authenticatedSupabase } = context;

    // 1. Zera o contador na tabela links
    const { error: linkError } = await authenticatedSupabase
      .from("links")
      .update({ clicks_count: 0 })
      .eq("id", id)
      .eq("user_id", userId);

    if (linkError) throw linkError;

    // 2. Remove registros de cliques relacionados em ambas as tabelas
    await authenticatedSupabase
      .from("link_clicks")
      .delete()
      .eq("link_id", id);

    await authenticatedSupabase
      .from("clicks")
      .delete()
      .eq("link_id", id);

    return { success: true };
  });

export const getUserProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { data: profile, error } = await authenticatedSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) return { error: error.message };
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