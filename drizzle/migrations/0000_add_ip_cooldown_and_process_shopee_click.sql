CREATE TABLE IF NOT EXISTS public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.links(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.link_clicks TO service_role;

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_link_clicks_lookup
ON public.link_clicks (link_id, ip_address, created_at);

CREATE TABLE IF NOT EXISTS public.ip_cooldown (
  ip_address text PRIMARY KEY,
  last_click_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ip_cooldown TO service_role;

ALTER TABLE public.ip_cooldown ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ip_cooldown_last_click
ON public.ip_cooldown (ip_address, last_click_at);

DROP POLICY IF EXISTS "Permitir leitura ip_cooldown" ON public.ip_cooldown;
DROP POLICY IF EXISTS "Permitir operacoes ip_cooldown" ON public.ip_cooldown;

REVOKE ALL ON public.ip_cooldown FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.link_clicks FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_shopee_click(
  p_slug text,
  p_ip text,
  p_has_cookie boolean DEFAULT false
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
  v_valid_ip boolean := false;
BEGIN
  v_clean_slug := lower(btrim(coalesce(p_slug, ''), '/'));

  IF v_clean_slug LIKE 'arquivos/%' THEN
    v_clean_slug := substr(v_clean_slug, 10);
  END IF;

  IF v_clean_slug = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'destination_url', NULL,
      'is_valid_click', false,
      'error', 'Slug inválido'
    );
  END IF;

  SELECT id, affiliate_url, status, expires_at, clicks_count, slug
  INTO v_link
  FROM public.links
  WHERE (
    lower(btrim(slug, '/')) = v_clean_slug OR
    lower(btrim(slug, '/')) = 'arquivos/' || v_clean_slug
  )
    AND (status = 'active' OR status IS NULL)
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY CASE WHEN lower(btrim(slug, '/')) = v_clean_slug THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'destination_url', NULL,
      'is_valid_click', false,
      'error', 'Link não encontrado ou expirado'
    );
  END IF;

  v_dest_url := v_link.affiliate_url;
  v_valid_ip := p_ip IS NOT NULL
    AND btrim(p_ip) <> ''
    AND lower(btrim(p_ip)) NOT IN ('visitor', 'unknown');

  IF p_has_cookie IS TRUE THEN
    v_in_cooldown := true;
  END IF;

  IF NOT v_in_cooldown AND v_valid_ip THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(btrim(p_ip), 0));

    SELECT EXISTS (
      SELECT 1
      FROM public.ip_cooldown
      WHERE ip_address = btrim(p_ip)
        AND last_click_at > (now() - interval '7 days')
    )
    INTO v_in_cooldown;
  END IF;

  IF NOT v_in_cooldown THEN
    v_is_valid := true;

    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = now()
    WHERE id = v_link.id;

    INSERT INTO public.clicks (link_id, ip_address, clicked_at, slug)
    VALUES (v_link.id, COALESCE(NULLIF(btrim(p_ip), ''), 'visitor'), now(), v_link.slug);

    INSERT INTO public.link_clicks (link_id, ip_address, created_at)
    VALUES (v_link.id, COALESCE(NULLIF(btrim(p_ip), ''), 'visitor'), now());

    IF v_valid_ip THEN
      INSERT INTO public.ip_cooldown (ip_address, last_click_at)
      VALUES (btrim(p_ip), now())
      ON CONFLICT (ip_address)
      DO UPDATE SET last_click_at = EXCLUDED.last_click_at;
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

REVOKE ALL ON FUNCTION public.process_shopee_click(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_shopee_click(text, text, boolean) TO anon, authenticated, service_role;