-- Sincronizar os contadores individuais com os cliques brutos para manter consistência visual na tabela
UPDATE public.links l
SET clicks_count = (
  SELECT COUNT(*) 
  FROM public.clicks c 
  WHERE c.link_id = l.id
)
WHERE id IN (
  SELECT l2.id
  FROM public.links l2
  JOIN public.clicks c2 ON l2.id = c2.link_id
  GROUP BY l2.id
  HAVING l2.clicks_count != COUNT(c2.id)
);

-- Atualizar a função de incremento para contar cliques brutos em vez de únicos por IP
-- Isso evita a confusão onde o total parece menor que o diário
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links
  SET clicks_count = (
    SELECT COUNT(*) 
    FROM public.clicks 
    WHERE link_id = increment_link_clicks.link_id
  ),
  updated_at = NOW()
  WHERE id = increment_link_clicks.link_id;
END;
$$;