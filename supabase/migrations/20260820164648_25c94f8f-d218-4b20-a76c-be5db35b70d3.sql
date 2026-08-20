-- Corrigir a função increment_link_clicks para garantir que ela seja determinística e robusta
-- Revogamos acesso público e autenticado para segurança
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizamos o contador baseando-se no total de IPs únicos na tabela de cliques
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

-- Restringir execução apenas ao service_role para evitar chamadas maliciosas do frontend
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;