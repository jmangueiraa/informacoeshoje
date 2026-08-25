ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.clicks c
SET slug = l.slug
FROM public.links l
WHERE c.link_id = l.id AND c.slug IS NULL;

CREATE INDEX IF NOT EXISTS clicks_slug_idx ON public.clicks (slug);

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

  SELECT id, affiliate_url, slug INTO v_link_id, url_dest, v_slug
  FROM public.links
  WHERE btrim(slug, '/') = v_slug
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_link_id IS NOT NULL THEN
    INSERT INTO public.clicks (link_id, slug) VALUES (v_link_id, v_slug);

    UPDATE public.links
    SET clicks_count = (SELECT count(*) FROM public.clicks WHERE slug = v_slug),
        updated_at = now()
    WHERE id = v_link_id;
  END IF;

  RETURN url_dest;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_all_link_clicks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.links l
  SET clicks_count = (
    SELECT count(*) FROM public.clicks c WHERE c.slug = l.slug
  );
END;
$function$;