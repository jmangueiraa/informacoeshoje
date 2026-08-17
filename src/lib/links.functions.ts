import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const createLinkSchema = z.object({
  affiliateUrl: z.string().url().refine(url => url.includes('shopee.com.br'), {
    message: "Apenas links da Shopee são permitidos"
  }),
  slug: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Slug deve conter apenas letras, números, hífens e underlines"
  }),
  title: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  customDomain: z.string().optional().nullable(),
});

export const checkSlugAvailability = createServerFn({ method: "GET" })
  .inputValidator((slug) => z.string().parse(slug))
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
  .inputValidator((data) => createLinkSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    // Verificar limite do plano (simplificado por enquanto)
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan_id, plans(max_links)")
      .eq("id", user.id)
      .single();

    const { count } = await supabase
      .from("links")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", user.id);

    const maxLinks = (profile?.plans as any)?.max_links || 10;
    if (count !== null && count >= maxLinks) {
      throw new Error(`Limite de links atingido para o plano atual (${maxLinks})`);
    }

    const { data: link, error } = await supabase
      .from("links")
      .insert({
        user_id: user.id,
        slug: data.slug,
        affiliate_url: data.affiliateUrl,
        title: data.title ?? null,
        expires_at: data.expiresAt ?? null,
        custom_domain: data.customDomain ?? null,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error("Este slug já está em uso.");
      throw error;
    }

    return link;
  });

export const getUserLinks = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("user_id", user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });

export const deleteLink = createServerFn({ method: "POST" })
  .inputValidator((id) => z.string().parse(id))
  .handler(async ({ data: id }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { error } = await supabase
      .from("links")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return { success: true };
  });

export const toggleLinkStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string(), status: z.enum(['active', 'inactive']) }).parse(data))
  .handler(async ({ data }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    const { error } = await supabase
      .from("links")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", user.id);

    if (error) throw error;
    return { success: true };
  });

export const getUserProfile = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) return { error: error.message };
    return profile;
  });

export const updateProfileDomain = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ domain: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };

    // 1. Atualizar o domínio no perfil
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ custom_domain: data.domain })
      .eq("id", user.id);

    if (profileError) return { error: profileError.message };

    // 2. Registrar na tabela de domínios para o redirect engine
    const { error: domainError } = await supabase
      .from("user_domains")
      .upsert({ 
        user_id: user.id, 
        domain: data.domain,
        is_verified: true
      }, { onConflict: 'domain' });

    if (domainError) return { error: domainError.message };

    return { success: true };
  });
