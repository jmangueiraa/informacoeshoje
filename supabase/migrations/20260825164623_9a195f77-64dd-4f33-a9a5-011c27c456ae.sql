CREATE OR REPLACE FUNCTION public.incrementar_clique(link_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  url_dest text;
  v_link_id uuid;
  v_slug text;
BEGIN
  v_slug := btrim(link_slug, '/');

  SELECT id, affiliate_url
  INTO v_link_id, url_dest
  FROM public.links
  WHERE btrim(slug, '/') = v_slug
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_link_id IS NOT NULL THEN
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = now()
    WHERE id = v_link_id;

    INSERT INTO public.clicks (link_id, slug)
    VALUES (v_link_id, v_slug);
  END IF;

  RETURN url_dest;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.incrementar_clique(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_all_link_clicks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.links l
  SET clicks_count = (
    SELECT count(*) FROM public.clicks c WHERE c.link_id = l.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;

CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = now()
  WHERE id = increment_link_clicks.link_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;