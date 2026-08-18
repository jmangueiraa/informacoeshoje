-- 1. Sincronizar todos os contadores de cliques na tabela links
UPDATE public.links l
SET clicks_count = (
  SELECT count(*) 
  FROM public.clicks c 
  WHERE c.link_id = l.id
);

-- 2. Atualizar a função increment_link_clicks
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_recent_click BOOLEAN;
BEGIN
  IF visitor_ip IS NOT NULL AND visitor_ip != 'unknown' AND visitor_ip != '' THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.clicks 
      WHERE clicks.link_id = increment_link_clicks.link_id 
        AND clicks.ip_address = visitor_ip
        AND clicks.clicked_at > (NOW() - INTERVAL '24 hours')
    ) INTO has_recent_click;
  ELSE
    has_recent_click := FALSE;
  END IF;

  IF NOT has_recent_click THEN
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = NOW()
    WHERE id = increment_link_clicks.link_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;
