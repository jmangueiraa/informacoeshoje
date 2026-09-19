-- Migration: Shopee 7-day Attribution Tracking & Double Validation Cooldown (Cookies + IP)
-- Objetivo: Rastreamento espelhado na janela de 7 dias da Shopee com validação dupla (Cookies + IP Cooldown)

-- 1. Criação da tabela de quarentena de IPs (ip_cooldown)
CREATE TABLE IF NOT EXISTS public.ip_cooldown (
  ip_address text PRIMARY KEY,
  last_click_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas por IP e verificação do intervalo de 7 dias
CREATE INDEX IF NOT EXISTS idx_ip_cooldown_last_click 
ON public.ip_cooldown (ip_address, last_click_at);

-- 2. Habilitação de RLS e políticas de segurança
ALTER TABLE public.ip_cooldown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura ip_cooldown" ON public.ip_cooldown;
CREATE POLICY "Permitir leitura ip_cooldown"
ON public.ip_cooldown FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir operacoes ip_cooldown" ON public.ip_cooldown;
CREATE POLICY "Permitir operacoes ip_cooldown"
ON public.ip_cooldown FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

GRANT ALL ON public.ip_cooldown TO anon, authenticated, service_role;

-- 3. RPC Unificada: Processamento de clique com Validação Dupla (Cookie + IP 7 dias)
-- Executa a checagem, incremento e UPSERT em uma única transação atômica
CREATE OR REPLACE FUNCTION public.process_shopee_click(
  p_slug text,
  p_ip text,
  p_has_cookie boolean DEFAULT false,
  p_is_bot boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_slug text;
  v_link record;
  v_in_cooldown boolean := false;
  v_dest_url text;
  v_is_valid boolean := false;
BEGIN
  -- 1. Sanitização do slug (remove barras e prefixos)
  v_clean_slug := lower(btrim(p_slug, '/'));
  IF v_clean_slug LIKE 'arquivos/%' THEN
    v_clean_slug := substr(v_clean_slug, 10);
  END IF;

  -- 2. Localização do link ativo no banco
  SELECT id, affiliate_url, destination_url, url_destino, status, expires_at, clicks_count
  INTO v_link
  FROM public.links
  WHERE (
    lower(btrim(slug, '/')) = v_clean_slug OR
    lower(btrim(slug, '/')) = 'arquivos/' || v_clean_slug OR
    slug ILIKE v_clean_slug
  )
    AND (status = 'active' OR status IS NULL)
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  -- Se não encontrar o link ativo, retorna erro gracioso
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'destination_url', NULL,
      'is_valid_click', false,
      'error', 'Link não encontrado ou expirado'
    );
  END IF;

  v_dest_url := COALESCE(v_link.affiliate_url, v_link.destination_url, v_link.url_destino);

  -- Se for Bot, Crawler, Link Preview (WhatsApp/Google/Facebook) ou Prefetch, retorna a URL sem registrar clique nem cooldown
  IF p_is_bot IS TRUE THEN
    RETURN jsonb_build_object(
      'success', true,
      'destination_url', v_dest_url,
      'is_valid_click', false,
      'in_cooldown', false,
      'link_id', v_link.id
    );
  END IF;

  -- 3. Checagem 1 (Navegador/Cookie):
  -- Se o cookie shopee_click_cooldown existir, usuário está na quarentena
  IF p_has_cookie IS TRUE THEN
    v_in_cooldown := true;
  END IF;

  -- 4. Checagem 2 (Banco de Dados/IP):
  -- Se não havia cookie, checa se o IP clicou nos últimos 7 dias
  IF NOT v_in_cooldown AND p_ip IS NOT NULL AND p_ip <> '' AND p_ip <> 'visitor' AND p_ip <> 'unknown' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ip_cooldown
      WHERE ip_address = p_ip
        AND last_click_at > (now() - interval '7 days')
    ) INTO v_in_cooldown;
  END IF;

  -- 5. Registro do Clique Válido (Caminho Livre):
  -- Se passou nas duas checagens, incrementa contadores e faz UPSERT do IP
  IF NOT v_in_cooldown THEN
    v_is_valid := true;

    -- Incrementa contador oficial na tabela links
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = now()
    WHERE id = v_link.id;

    -- Registra o evento de clique para o Supabase Realtime e gráficos do painel
    INSERT INTO public.clicks (link_id, ip_address, clicked_at)
    VALUES (v_link.id, COALESCE(p_ip, 'visitor'), now());

    INSERT INTO public.link_clicks (link_id, ip_address, created_at)
    VALUES (v_link.id, COALESCE(p_ip, 'visitor'), now());

    -- UPSERT do IP na tabela ip_cooldown com a data atual (now())
    IF p_ip IS NOT NULL AND p_ip <> '' AND p_ip <> 'visitor' AND p_ip <> 'unknown' THEN
      INSERT INTO public.ip_cooldown (ip_address, last_click_at)
      VALUES (p_ip, now())
      ON CONFLICT (ip_address)
      DO UPDATE SET last_click_at = now();
    END IF;
  END IF;

  -- 6. Resposta estruturada com a URL final para redirecionamento
  RETURN jsonb_build_object(
    'success', true,
    'destination_url', v_dest_url,
    'is_valid_click', v_is_valid,
    'in_cooldown', v_in_cooldown,
    'link_id', v_link.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_shopee_click(text, text, boolean, boolean) TO anon, authenticated, service_role;

-- Função para limpar/resetar o registro de cooldown de IPs (para testes e manutenção)
CREATE OR REPLACE FUNCTION public.clear_all_ip_cooldown()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.ip_cooldown;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_ip_cooldown() TO anon, authenticated, service_role;

-- 4. Atualização da função legado incrementar_clique para compatibilidade retroativa
CREATE OR REPLACE FUNCTION public.incrementar_clique(link_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.process_shopee_click(link_slug, 'visitor', false);
  RETURN v_result->>'destination_url';
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_clique(text) TO anon, authenticated, service_role;

-- 5. Função para listar os IPs e a contagem regressiva / dias faltantes para liberar o próximo clique
CREATE OR REPLACE FUNCTION public.get_ip_cooldown_status()
RETURNS TABLE (
  ip_address text,
  last_click_at timestamp with time zone,
  cooldown_until timestamp with time zone,
  days_remaining numeric,
  hours_remaining numeric,
  formatted_time_remaining text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.ip_address,
    c.last_click_at,
    (c.last_click_at + interval '7 days') AS cooldown_until,
    ROUND(GREATEST(0, EXTRACT(EPOCH FROM ((c.last_click_at + interval '7 days') - now())) / 86400.0)::numeric, 1) AS days_remaining,
    ROUND(GREATEST(0, EXTRACT(EPOCH FROM ((c.last_click_at + interval '7 days') - now())) / 3600.0)::numeric, 1) AS hours_remaining,
    CASE 
      WHEN (c.last_click_at + interval '7 days') <= now() THEN 'Liberado para novo clique'
      ELSE 
        CONCAT(
          FLOOR(EXTRACT(EPOCH FROM ((c.last_click_at + interval '7 days') - now())) / 86400), 'd ',
          FLOOR(MOD(EXTRACT(EPOCH FROM ((c.last_click_at + interval '7 days') - now())) / 3600, 24)), 'h ',
          FLOOR(MOD(EXTRACT(EPOCH FROM ((c.last_click_at + interval '7 days') - now())) / 60, 60)), 'm restantes'
        )
    END AS formatted_time_remaining,
    CASE 
      WHEN (c.last_click_at + interval '7 days') <= now() THEN 'Liberado'
      ELSE 'Em Quarentena'
    END AS status
  FROM public.ip_cooldown c
  ORDER BY c.last_click_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ip_cooldown_status() TO anon, authenticated, service_role;
