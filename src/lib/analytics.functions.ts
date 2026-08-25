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
      slug: data.slug,
      user_agent: data.userAgent ?? null,
      device_type: deviceType,
      browser: browser,
      operating_system: os,
      referrer: data.referrer ?? null,
      ip_address: ip,
    });

    // 5. Incrementar contador de cliques no link via RPC (recalcula a partir da tabela clicks)
    const { error: rpcError } = await supabase.rpc('increment_link_clicks', {
      link_id: link.id,
      visitor_ip: ip
    });

    if (rpcError) {
      console.error("Erro ao incrementar cliques via RPC (anon):", rpcError);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc('increment_link_clicks', { link_id: link.id, visitor_ip: ip });
      } catch (e) {
        console.error("Falha no fallback admin ao incrementar cliques:", e);
      }
    }

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

    // Total de cliques únicos acumulados nos links do usuário
    // O valor correto de "Cliques Totais" deve ser a soma de cliques brutos ou únicos? 
    // O usuário estranhou que o total (10) era menor que os das últimas 24h (16).
    // Isso acontece porque estamos usando o contador de cliques ÚNICOS no total, mas Cliques Hoje conta tudo.
    // Vamos padronizar: Cliques Totais = Soma de todos os registros na tabela clicks para os links do usuário.
    
    const linkIds = links?.map(l => l.id) || [];
    let totalClicks = 0;
    let clicksToday = 0;

    if (linkIds.length > 0) {
      // Total de cliques brutos (registros na tabela clicks)
      const { count: totalRaw } = await authenticatedSupabase
        .from("clicks")
        .select("*", { count: 'exact', head: true })
        .in("link_id", linkIds);
      
      totalClicks = totalRaw || 0;

      // Cliques nas últimas 24h (brutos)
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
