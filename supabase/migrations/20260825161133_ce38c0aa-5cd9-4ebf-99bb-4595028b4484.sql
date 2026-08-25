CREATE OR REPLACE FUNCTION public.incrementar_clique(link_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  url_dest text;
  v_link_id uuid;
BEGIN
  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = now()
  WHERE btrim(slug, '/') = btrim(link_slug, '/')
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id, affiliate_url INTO v_link_id, url_dest;

  IF v_link_id IS NOT NULL THEN
    INSERT INTO public.clicks (link_id) VALUES (v_link_id);
  END IF;

  RETURN url_dest;
END;
$$;

-- Reconstrói o histórico de cliques para links cujo contador está maior que os registros existentes
INSERT INTO public.clicks (link_id, clicked_at)
SELECT l.id, l.updated_at
FROM public.links l
CROSS JOIN LATERAL generate_series(
  1,
  GREATEST(COALESCE(l.clicks_count, 0) - (SELECT count(*) FROM public.clicks c WHERE c.link_id = l.id), 0)
) AS g
WHERE COALESCE(l.clicks_count, 0) > (SELECT count(*) FROM public.clicks c WHERE c.link_id = l.id);