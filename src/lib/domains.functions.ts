import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLATFORM_DOMAIN } from "./constants";

const domainSchema = z.string().transform((val) => {
  return val
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .trim();
});

export const getUserDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { data, error } = await authenticatedSupabase
      .from("user_domains")
      .select("*")
      .eq("user_id", userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const addUserDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    domain: domainSchema,
    type: z.enum(['subdomain', 'custom'])
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // Apenas administradores podem cadastrar novos domínios
    const { data: isAdmin } = await authenticatedSupabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });
    if (!isAdmin) {
      throw new Error("Apenas administradores podem adicionar domínios.");
    }


    let finalDomain = data.domain;
    if (data.type === 'subdomain') {
      if (!finalDomain.includes('.')) {
        finalDomain = `${finalDomain}.${PLATFORM_DOMAIN}`;
      }
    }

    // Verificar se o domínio já existe
    const { data: existing } = await authenticatedSupabase
      .from("user_domains")
      .select("id")
      .eq("domain", finalDomain)
      .maybeSingle();

    if (existing) {
      throw new Error("Este domínio já está sendo utilizado.");
    }

    const { data: newDomain, error } = await authenticatedSupabase
      .from("user_domains")
      .insert({
        user_id: userId,
        domain: finalDomain,
        domain_type: data.type,
        verification_status: data.type === 'subdomain' ? 'verified' : 'pending',
        is_primary: false // O usuário define depois
      })
      .select()
      .single();

    if (error) throw error;
    return newDomain;
  });

export const setPrimaryDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // 1. Desmarcar todos os outros como primários
    await authenticatedSupabase
      .from("user_domains")
      .update({ is_primary: false })
      .eq("user_id", userId);

    // 2. Marcar o escolhido como primário
    const { error } = await authenticatedSupabase
      .from("user_domains")
      .update({ is_primary: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    // 3. Atualizar o custom_domain no perfil para retrocompatibilidade
    const { data: domainData } = await authenticatedSupabase
      .from("user_domains")
      .select("domain")
      .eq("id", id)
      .single();
    
    if (domainData) {
      await authenticatedSupabase
        .from("profiles")
        .update({ custom_domain: domainData.domain })
        .eq("id", userId);
    }

    return { success: true };
  });

export const deleteUserDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { error } = await authenticatedSupabase
      .from("user_domains")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return { success: true };
  });

export const verifyDomainDNS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    const { data: domainData, error: fetchError } = await authenticatedSupabase
      .from("user_domains")
      .select("domain, domain_type")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !domainData) throw new Error("Domínio não encontrado.");

    if (domainData.domain_type === 'subdomain') {
      return { status: 'verified', message: "Subdomínios são verificados automaticamente." };
    }

    try {
      // Usar a API DoH do Google para verificar CNAME
      // O CNAME deve apontar para o domínio da aplicação
      const appHost = PLATFORM_DOMAIN;
      const response = await fetch(`https://dns.google/resolve?name=${domainData.domain}&type=CNAME`);
      const result = await response.json();

      const cnameRecord = result.Answer?.find((a: any) => a.type === 5); // 5 = CNAME
      const isCorrect = cnameRecord?.data?.includes(appHost) || cnameRecord?.data === `${appHost}.`;

      if (isCorrect) {
        await authenticatedSupabase
          .from("user_domains")
          .update({ verification_status: 'verified' })
          .eq("id", id);
        return { status: 'verified', message: "Domínio verificado com sucesso!" };
      } else {
        await authenticatedSupabase
          .from("user_domains")
          .update({ verification_status: 'failed' })
          .eq("id", id);
        return { status: 'failed', message: "O CNAME não aponta para o endereço correto." };
      }
    } catch (err) {
      console.error("DNS verification error:", err);
      return { status: 'failed', message: "Erro ao consultar o DNS. Tente novamente mais tarde." };
    }
  });
