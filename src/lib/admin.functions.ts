import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // Verificar se o usuário é admin
    const { data: isAdmin, error: roleError } = await authenticatedSupabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      throw new Error("Não autorizado: Acesso administrativo apenas.");
    }

    // Buscar estatísticas globais
    const [usersCount, linksCount, clicksCount] = await Promise.all([
      authenticatedSupabase.from("profiles").select("*", { count: 'exact', head: true }),
      authenticatedSupabase.from("links").select("*", { count: 'exact', head: true }),
      authenticatedSupabase.from("clicks").select("*", { count: 'exact', head: true }),
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

    const { data: isAdmin, error } = await authenticatedSupabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (error) {
      console.error("Erro ao verificar role:", error);
      return false;
    }

    return !!isAdmin;
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase: authenticatedSupabase } = context;

    // Verificar se o usuário é admin
    const { data: isAdmin, error: roleError } = await authenticatedSupabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      throw new Error("Não autorizado: Acesso administrativo apenas.");
    }

    // Buscar todos os perfis com informações de plano
    const { data: users, error } = await authenticatedSupabase
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