-- Função para incrementar cliques de forma atômica
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = NOW()
  WHERE id = link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_link_clicks(UUID) TO anon, authenticated;
