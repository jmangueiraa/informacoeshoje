-- Sincronizar todos os links cujos contadores estão atrasados em relação à tabela de cliques
UPDATE public.links l
SET clicks_count = (
  SELECT COUNT(DISTINCT ip_address) 
  FROM public.clicks c 
  WHERE c.link_id = l.id
)
WHERE id IN (
  SELECT l2.id
  FROM public.links l2
  JOIN public.clicks c2 ON l2.id = c2.link_id
  GROUP BY l2.id
  HAVING l2.clicks_count < COUNT(DISTINCT c2.ip_address)
);

-- Corrigir a função increment_link_clicks para garantir que ela seja determinística e robusta
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_recent_click BOOLEAN;
BEGIN
  -- Verificar se já existe um registro deste IP para este link nas últimas 24h
  -- Importante: A verificação deve ser feita ANTES da inserção do novo clique 
  -- se chamarmos o RPC após o insert manual, ou o RPC deve fazer o insert.
  -- Atualmente no código o registerClick faz o insert antes de chamar o RPC.
  -- Por isso, precisamos olhar cliques anteriores ao atual.
  
  IF visitor_ip IS NOT NULL AND visitor_ip != 'unknown' AND visitor_ip != '' THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.clicks 
      WHERE clicks.link_id = increment_link_clicks.link_id 
        AND clicks.ip_address = visitor_ip
        AND clicks.clicked_at > (NOW() - INTERVAL '24 hours')
        AND clicks.id NOT IN (
          SELECT id FROM public.clicks 
          WHERE link_id = increment_link_clicks.link_id 
          ORDER BY clicked_at DESC LIMIT 1
        )
    ) INTO has_recent_click;
  ELSE
    has_recent_click := FALSE;
  END IF;

  -- Se não houver clique recente (exceto o que acabou de ser inserido), incrementa
  -- Mas para simplificar e garantir precisão, vamos apenas contar o total único se necessário
  -- Ou garantir que o incremento aconteça pelo menos uma vez para IPs novos.
  
  UPDATE public.links
  SET clicks_count = (
    SELECT COUNT(DISTINCT ip_address) 
    FROM public.clicks 
    WHERE link_id = increment_link_clicks.link_id
  ),
  updated_at = NOW()
  WHERE id = increment_link_clicks.link_id;
END;
$$;