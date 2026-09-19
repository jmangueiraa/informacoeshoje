import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    // Verificar se o usuário é admin
    const { data: adminRole, error: roleError } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole || userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado: Acesso administrativo apenas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar estatísticas globais
    const [usersCount, linksCount, clicksCount] = await Promise.all([
      supabaseAdmin.from("profiles").select("*", { count: 'exact', head: true }),
      supabaseAdmin.from("links").select("*", { count: 'exact', head: true }),
      supabaseAdmin.from("clicks").select("*", { count: 'exact', head: true }),
    ]);

    return {
      totalUsers: usersCount.count || 0,
      totalLinks: linksCount.count || 0,
      totalClicks: clicksCount.count || 0,
    };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    const { data: adminRole, error } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar role:", error);
      return false;
    }

    return !!adminRole && userEmail === allowedAdminEmail;
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    // Verificar se o usuário é admin
    const { data: adminRole, error: roleError } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole || userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado: Acesso administrativo apenas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Buscar todos os perfis com informações de plano
    const { data: users, error } = await supabaseAdmin
      .from("profiles")
      .select(`
        *,
        plans (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Erro ao buscar usuários:", error);
      throw new Error("Erro ao carregar lista de usuários.");
    }

    return users || [];
  });

export const getAdminDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    // Verificar se o usuário é admin
    const { data: adminRole, error: roleError } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole || userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado: Acesso administrativo apenas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: domains, error } = await supabaseAdmin
      .from("user_domains")
      .select(`
        *,
        profiles (
          full_name,
          username
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return domains || [];
  });

export const deleteAdminDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id, context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    // Verificar se o usuário é admin
    const { data: adminRole, error: roleError } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole || userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("user_domains")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  });

export const getAdminIpCooldownList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;
    const allowedAdminEmail = 'ajpentretedimento@hotmail.com';
    const userEmail = typeof context.claims.email === 'string' ? context.claims.email.toLowerCase() : '';

    const { data: adminRole, error: roleError } = await authenticatedSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole || userEmail !== allowedAdminEmail) {
      throw new Error("Não autorizado: Acesso administrativo apenas.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Executa a RPC get_ip_cooldown_status ou faz consulta direta
    const { data, error } = await supabaseAdmin.rpc('get_ip_cooldown_status' as any);

    if (error) {
      console.warn("Aviso ao buscar RPC get_ip_cooldown_status, usando fallback:", error);
      // Fallback: consulta direta na tabela ip_cooldown
      const { data: rawData, error: rawError } = await supabaseAdmin
        .from('ip_cooldown' as any)
        .select('*')
        .order('last_click_at', { ascending: false });

      if (rawError) throw rawError;

      const now = new Date().getTime();
      return (rawData || []).map((row: any) => {
        const lastClick = new Date(row.last_click_at).getTime();
        const cooldownUntil = lastClick + 7 * 24 * 60 * 60 * 1000;
        const diffMs = cooldownUntil - now;
        const inCooldown = diffMs > 0;
        const daysRemaining = inCooldown ? Math.round((diffMs / (24 * 3600 * 1000)) * 10) / 10 : 0;
        const hoursRemaining = inCooldown ? Math.round((diffMs / (3600 * 1000)) * 10) / 10 : 0;

        let formatted = 'Liberado para novo clique';
        if (inCooldown) {
          const days = Math.floor(diffMs / (24 * 3600 * 1000));
          const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
          const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
          formatted = `${days}d ${hours}h ${minutes}m restantes`;
        }

        return {
          ip_address: row.ip_address,
          last_click_at: row.last_click_at,
          cooldown_until: new Date(cooldownUntil).toISOString(),
          days_remaining: daysRemaining,
          hours_remaining: hoursRemaining,
          formatted_time_remaining: formatted,
          status: inCooldown ? 'Em Quarentena' : 'Liberado',
        };
      });
    }

    return data || [];
  });