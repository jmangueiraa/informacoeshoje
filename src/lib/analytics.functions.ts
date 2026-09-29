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

export const getIpCooldownList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Busca dados das tabelas ip_cooldown, clicks, link_clicks e links em paralelo
    const [
      { data: rawData },
      { data: clicksData },
      { data: linkClicksData },
      { data: linksData }
    ] = await Promise.all([
      supabaseAdmin
        .from('ip_cooldown' as any)
        .select('*')
        .order('last_click_at', { ascending: false }),
      supabaseAdmin
        .from('clicks')
        .select('ip_address, slug, link_id, clicked_at')
        .order('clicked_at', { ascending: false })
        .limit(3000),
      supabaseAdmin
        .from('link_clicks' as any)
        .select('ip_address, link_id, created_at')
        .order('created_at', { ascending: false })
        .limit(3000),
      supabaseAdmin
        .from('links')
        .select('id, slug, title')
    ]);

    const linksMap = new Map<string, string>();
    (linksData || []).forEach((l: any) => {
      if (l.id && l.slug) linksMap.set(l.id, l.slug);
    });

    const ipMap = new Map<string, { ip_address: string; last_click_at: string; slug: string | null }>();

    // Incorpora registros de ip_cooldown
    (rawData || []).forEach((row: any) => {
      if (row.ip_address && row.ip_address !== 'visitor') {
        ipMap.set(row.ip_address, {
          ip_address: row.ip_address,
          last_click_at: row.last_click_at,
          slug: row.slug || null,
        });
      }
    });

    // Incorpora registros da tabela clicks
    (clicksData || []).forEach((c: any) => {
      if (c.ip_address && c.ip_address !== 'visitor') {
        const foundSlug = c.slug || (c.link_id ? linksMap.get(c.link_id) : '') || '';
        const existing = ipMap.get(c.ip_address);
        if (!existing) {
          ipMap.set(c.ip_address, {
            ip_address: c.ip_address,
            last_click_at: c.clicked_at || new Date().toISOString(),
            slug: foundSlug || null,
          });
        } else {
          if (c.clicked_at && new Date(c.clicked_at).getTime() > new Date(existing.last_click_at).getTime()) {
            existing.last_click_at = c.clicked_at;
          }
          if (!existing.slug && foundSlug) {
            existing.slug = foundSlug;
          }
        }
      }
    });

    // Incorpora registros da tabela link_clicks
    (linkClicksData || []).forEach((lc: any) => {
      if (lc.ip_address && lc.ip_address !== 'visitor') {
        const foundSlug = lc.link_id ? linksMap.get(lc.link_id) : '';
        const existing = ipMap.get(lc.ip_address);
        if (!existing) {
          ipMap.set(lc.ip_address, {
            ip_address: lc.ip_address,
            last_click_at: lc.created_at || new Date().toISOString(),
            slug: foundSlug || null,
          });
        } else {
          if (lc.created_at && new Date(lc.created_at).getTime() > new Date(existing.last_click_at).getTime()) {
            existing.last_click_at = lc.created_at;
          }
          if (!existing.slug && foundSlug) {
            existing.slug = foundSlug;
          }
        }
      }
    });

    const now = new Date().getTime();
    const sortedList = Array.from(ipMap.values()).sort(
      (a, b) => new Date(b.last_click_at).getTime() - new Date(a.last_click_at).getTime()
    );

    return sortedList.map((row: any) => {
      const lastClick = new Date(row.last_click_at).getTime();
      const cooldownUntil = lastClick + 7 * 24 * 60 * 60 * 1000;
      const diffMs = cooldownUntil - now;
      const inCooldown = diffMs > 0;
      const daysRemaining = inCooldown ? Math.round((diffMs / (24 * 3600 * 1000)) * 10) / 10 : 0;
      const hoursRemaining = inCooldown ? Math.round((diffMs / (3600 * 1000)) * 10) / 10 : 0;

      let formattedTimeRemaining = 'Liberado para novo clique';
      if (inCooldown) {
        const days = Math.floor(diffMs / (24 * 3600 * 1000));
        const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
        const minutes = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        formattedTimeRemaining = `${days}d ${hours}h ${minutes}m restantes`;
      }

      return {
        ip_address: row.ip_address,
        slug: row.slug || null,
        last_click_at: row.last_click_at,
        cooldown_until: new Date(cooldownUntil).toISOString(),
        days_remaining: daysRemaining,
        hours_remaining: hoursRemaining,
        formatted_time_remaining: formattedTimeRemaining,
        status: inCooldown ? 'Em Quarentena' : 'Liberado',
      };
    });
  });

