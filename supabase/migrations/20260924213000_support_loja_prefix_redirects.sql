-- Migration: Suporte ao prefixo /loja/ e /arquivos/ no redirecionamento Shopee
-- Permite que links acessados como /loja/slug ou /arquivos/slug redirecionem diretamente para o link de afiliado sem erro

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
  -- 1. Sanitização do slug (remove barras e prefixos loja/ e arquivos/)
  v_clean_slug := lower(btrim(p_slug, '/'));
  IF v_clean_slug LIKE 'arquivos/%' THEN
    v_clean_slug := substr(v_clean_slug, 10);
  END IF;
  IF v_clean_slug LIKE 'loja/%' THEN
    v_clean_slug := substr(v_clean_slug, 6);
  END IF;

  -- 2. Localização do link ativo no banco (procura o slug puro, com prefixos e variantes)
  SELECT id, affiliate_url, destination_url, url_destino, status, expires_at, clicks_count
  INTO v_link
  FROM public.links
  WHERE (
    lower(btrim(slug, '/')) = v_clean_slug OR
    lower(btrim(slug, '/')) = 'arquivos/' || v_clean_slug OR
    lower(btrim(slug, '/')) = 'loja/' || v_clean_slug OR
    slug ILIKE v_clean_slug OR
    slug ILIKE 'loja/' || v_clean_slug OR
    slug ILIKE 'arquivos/' || v_clean_slug
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
  IF p_has_cookie IS TRUE THEN
    v_in_cooldown := true;
  END IF;

  -- 4. Checagem 2 (IP no Supabase):
  IF v_in_cooldown IS FALSE AND p_ip IS NOT NULL AND p_ip != 'visitor' AND p_ip != '' THEN
    IF EXISTS (
      SELECT 1 
      FROM public.ip_cooldown 
      WHERE ip_address = p_ip 
        AND last_click_at > (now() - INTERVAL '7 days')
    ) THEN
      v_in_cooldown := true;
    END IF;
  END IF;

  -- 5. Se NÃO estiver em quarentena (clique válido e contabilizável):
  IF v_in_cooldown IS FALSE THEN
    v_is_valid := true;

    -- Incrementa contagem do link
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = v_link.id;

    -- Registra na tabela de clicks
    INSERT INTO public.clicks (link_id, ip_address, slug, clicked_at)
    VALUES (v_link.id, p_ip, v_clean_slug, now());

    -- Registra na tabela link_clicks
    INSERT INTO public.link_clicks (link_id, ip_address, clicked_at)
    VALUES (v_link.id, p_ip, now());

    -- Atualiza ou insere IP na quarentena com timestamp renovado
    IF p_ip IS NOT NULL AND p_ip != 'visitor' AND p_ip != '' THEN
      INSERT INTO public.ip_cooldown (ip_address, last_click_at, created_at, slug, link_id)
      VALUES (p_ip, now(), now(), v_clean_slug, v_link.id)
      ON CONFLICT (ip_address) 
      DO UPDATE SET 
        last_click_at = EXCLUDED.last_click_at,
        slug = EXCLUDED.slug,
        link_id = EXCLUDED.link_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'destination_url', v_dest_url,
    'is_valid_click', v_is_valid,
    'in_cooldown', v_in_cooldown,
    'link_id', v_link.id
  );
END;
$$;
