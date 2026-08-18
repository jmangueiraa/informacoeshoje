-- 1. Sincronizar clicks_count na tabela links com a contagem real na tabela clicks
UPDATE public.links l
SET clicks_count = (
  WITH unique_clicks AS (
    SELECT DISTINCT ON (link_id, ip_address, floor(extract(epoch from clicked_at) / 86400))
           link_id
    FROM public.clicks
    WHERE link_id = l.id
  )
  SELECT count(*) FROM unique_clicks
);

-- 2. Garantir que a função increment_link_clicks esteja correta e segura
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_recent_click BOOLEAN;
BEGIN
  -- Se o IP foi fornecido, verifica se houve clique nas últimas 24 horas para este link específico
  IF visitor_ip IS NOT NULL AND visitor_ip != 'unknown' THEN
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

  -- Só incrementa o contador se não houver clique recente do mesmo IP
  IF NOT has_recent_click THEN
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = NOW()
    WHERE id = increment_link_clicks.link_id;
  END IF;
END;
$$;

-- 3. Permissões estritas
ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;
