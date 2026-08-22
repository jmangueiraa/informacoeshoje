import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
      status: 'active'
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

    const { data, error } = await authenticatedSupabase
      .from("links")
      .select("*")
      .eq("user_id", userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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
    const cleanPhone = data.phone.replace(/\D/g, "");
    const lastDigits = cleanPhone.slice(-4);
    const slug = `rastreio-${nomeLimpo}-${lastDigits}`;

    const insertData = {
      user_id: userId,
      slug,
      affiliate_url: data.affiliateUrl,
      title: `Rastreio - ${data.name} (${data.phone})`,
      status: 'active'
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