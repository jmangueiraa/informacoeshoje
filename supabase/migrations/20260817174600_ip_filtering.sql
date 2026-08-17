-- Adicionar coluna ip_address à tabela clicks
ALTER TABLE public.clicks ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Atualizar a função increment_link_clicks para filtrar por IP nas últimas 24h
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id UUID, visitor_ip TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_recent_click BOOLEAN;
BEGIN
  -- Se o IP foi fornecido, verifica se houve clique nas últimas 24 horas
  IF visitor_ip IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.clicks 
      WHERE clicks.link_id = increment_link_clicks.link_id 
        AND clicks.ip_address = visitor_ip
        AND clicks.clicked_at > NOW() - INTERVAL '24 hours'
    ) INTO has_recent_click;
  ELSE
    has_recent_click := FALSE;
  END IF;

  -- Só incrementa se não houver clique recente do mesmo IP
  IF NOT has_recent_click THEN
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = NOW()
    WHERE id = link_id;
  END IF;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(UUID, TEXT) TO anon, authenticated, service_role;
