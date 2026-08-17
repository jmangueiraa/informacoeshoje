-- Sincronizar contadores de cliques com base nos registros reais na tabela clicks
UPDATE public.links l
SET clicks_count = (
  SELECT count(*) 
  FROM public.clicks c 
  WHERE c.link_id = l.id
);

-- Remover a função antiga para poder recriá-la sem erros de assinatura/parâmetros
DROP FUNCTION IF EXISTS public.increment_link_clicks(uuid, text);

-- Recriar a função increment_link_clicks de forma robusta
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
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
        AND clicks.clicked_at > (NOW() - INTERVAL '24 hours')
    ) INTO has_recent_click;
  ELSE
    has_recent_click := FALSE;
  END IF;

  -- Só incrementa se não houver clique recente do mesmo IP
  IF NOT has_recent_click THEN
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = NOW()
    WHERE id = increment_link_clicks.link_id;
  END IF;
END;
$$;
