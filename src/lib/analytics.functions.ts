import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase: authenticatedSupabase, userId } = context;

    // Total de links do usuário
    const { count: totalLinks } = await authenticatedSupabase
      .from("links")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);

    // Total de cliques acumulados nos links do usuário
    const { data: links } = await authenticatedSupabase
      .from("links")
      .select("id, slug, clicks_count, status")
      .eq("user_id", userId);

    // Cada evento pertence ao ID individual do link, sem qualquer agrupamento por URL de destino.
    const linkIds = links?.map((link) => link.id) || [];
    let totalClicks = 0;
    let clicksToday = 0;

    if (linkIds.length > 0) {
      const { count: totalRaw } = await authenticatedSupabase
        .from("clicks")
        .select("*", { count: 'exact', head: true })
        .in("link_id", linkIds);

      totalClicks = totalRaw || 0;

      // Cliques nas últimas 24h
      const today = new Date();
      today.setHours(today.getHours() - 24);

      const { count: rawToday } = await authenticatedSupabase
        .from("clicks")
        .select("*", { count: 'exact', head: true })
        .in("link_id", linkIds)
        .gte("clicked_at", today.toISOString());

      clicksToday = rawToday || 0;
    }

    const activeLinks = links?.filter(l => l.status === 'active').length || 0;

    return {
      totalLinks: totalLinks || 0,
      totalClicks,
      clicksToday,
      activeLinks
    };
  });
