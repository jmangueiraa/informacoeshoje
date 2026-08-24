CREATE OR REPLACE FUNCTION public.incrementar_clique(link_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  url_dest text;
BEGIN
  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = now()
  WHERE btrim(slug, '/') = btrim(link_slug, '/')
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING affiliate_url INTO url_dest;

  RETURN url_dest;
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_clique(text) TO anon, authenticated;