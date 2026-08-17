import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { UAParser } from "ua-parser-js";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveDomain } from "@/utils/domain-resolver";

export const registerClick = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    slug: z.string(),
    host: z.string().optional(),
    userAgent: z.string().optional(),
    referrer: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    
    // 1. Identificar o usuário pelo host
    const resolved = data.host ? await resolveDomain(data.host) : null;
    
    // 2. Buscar o link pelo slug
    let query = supabase
      .from("links")
      .select("id, affiliate_url, status, expires_at, user_id, domain_id")
      .eq("slug", data.slug);
    
    // Se o domínio for resolvido, garantimos que o link pertence ao usuário dono do domínio
    // e opcionalmente filtramos pelo domain_id se for um acesso via domínio customizado
    if (resolved?.userId) {
      query = query.eq("user_id", resolved.userId);
    } else if (resolved?.type === 'platform') {
      // Se estiver no domínio da plataforma, permitimos buscar links sem filtro de usuário
      // Mas priorizamos links que não têm domínio customizado associado (usando o padrão)
      query = query.is("domain_id", null);
    }

    const { data: link, error: linkError } = await query.maybeSingle();

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

    // 3. Obter IP do visitante de forma robusta
    const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               request?.headers.get("cf-connecting-ip") || 
               "unknown";

    // 4. Registrar o clique na tabela clicks
    await supabase.from("clicks").insert({
      link_id: link.id,
      user_agent: data.userAgent ?? null,
      device_type: deviceType,
      browser: browser,
      operating_system: os,
      referrer: data.referrer ?? null,
      ip_address: ip,
    });

    // 5. Incrementar contador de cliques no link via RPC (com filtro de IP de 24h)
    // Usamos supabaseAdmin para ignorar restrições de execução da função security definer
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc('increment_link_clicks', { 
      link_id: link.id,
      visitor_ip: ip
    });

    return { url: link.affiliate_url };
  });

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
      .select("id, clicks_count, status")
      .eq("user_id", userId);

    const totalClicks = links?.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0) || 0;
    const activeLinks = links?.filter(l => l.status === 'active').length || 0;

    // Cliques nas últimas 24h
    const today = new Date();
    today.setHours(today.getHours() - 24); // Mudança para "últimas 24h" reais em vez de "hoje 00:00"

    const linkIds = links?.map(l => l.id) || [];
    
    let clicksToday = 0;
    if (linkIds.length > 0) {
      const { count } = await authenticatedSupabase
        .from("clicks")
        .select("*", { count: 'exact', head: true })
        .in("link_id", linkIds)
        .gte("clicked_at", today.toISOString());
      clicksToday = count || 0;
    }

    return {
      totalLinks: totalLinks || 0,
      totalClicks,
      clicksToday,
      activeLinks
    };
  });
