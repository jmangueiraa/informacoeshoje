import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { UAParser } from "ua-parser-js";

export const registerClick = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    slug: z.string(),
    userAgent: z.string().optional(),
    referrer: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Buscar o link pelo slug
    const { data: link, error: linkError } = await supabase
      .from("links")
      .select("id, affiliate_url, status, expires_at")
      .eq("slug", data.slug)
      .maybeSingle();

    if (linkError || !link) {
      return { error: "Link não encontrado", status: 404 };
    }

    if (link.status !== 'active') {
      return { error: "Este link não está mais disponível", status: 403 };
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return { error: "Este link expirou", status: 410 };
    }

    // 2. Processar metadados do visitante
    const parser = new UAParser(data.userAgent);
    const result = parser.getResult();

    const deviceType = result.device.type || 'desktop';
    const browser = `${result.browser.name} ${result.browser.version}`;
    const os = `${result.os.name} ${result.os.version}`;

    // 3. Registrar o clique
    await supabase.from("clicks").insert({
      link_id: link.id,
      user_agent: data.userAgent ?? null,
      device_type: deviceType,
      browser: browser,
      operating_system: os,
      referrer: data.referrer ?? null,
    });

    // 4. Incrementar contador de cliques no link
    await supabase.rpc('increment_link_clicks', { link_id: link.id });

    return { url: link.affiliate_url };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado");

    // Total de links
    const { count: totalLinks } = await supabase
      .from("links")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", user.id);

    // Total de cliques e cliques hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: links } = await supabase
      .from("links")
      .select("id, clicks_count")
      .eq("user_id", user.id);

    const totalClicks = links?.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0) || 0;

    // Buscar cliques nas últimas 24h para os links do usuário
    const linkIds = links?.map(l => l.id) || [];
    
    let clicksToday = 0;
    if (linkIds.length > 0) {
      const { count } = await supabase
        .from("clicks")
        .select("*", { count: 'exact', head: true })
        .in("link_id", linkIds)
        .gte("clicked_at", today.toISOString());
      clicksToday = count || 0;
    }

    const activeLinks = links?.filter(l => true).length || 0; // Simplificado

    return {
      totalLinks: totalLinks || 0,
      totalClicks,
      clicksToday,
      activeLinks
    };
  });
