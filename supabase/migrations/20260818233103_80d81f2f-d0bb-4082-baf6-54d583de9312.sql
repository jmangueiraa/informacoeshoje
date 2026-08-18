-- Correção da contagem de cliques e integridade de dados ao excluir links

-- 1. Adicionar cascateamento na FK de clicks se ainda não existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'clicks_link_id_fkey' 
        AND table_name = 'clicks'
    ) THEN
        ALTER TABLE public.clicks DROP CONSTRAINT clicks_link_id_fkey;
    END IF;
    
    ALTER TABLE public.clicks 
    ADD CONSTRAINT clicks_link_id_fkey 
    FOREIGN KEY (link_id) 
    REFERENCES public.links(id) 
    ON DELETE CASCADE;
END $$;

-- 2. Corrigir a função increment_link_clicks para garantir consistência
CREATE OR REPLACE FUNCTION public.increment_link_clicks(link_id uuid, visitor_ip text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_recent_click BOOLEAN;
BEGIN
  -- Verificar clique recente (mesmo IP nas últimas 24h)
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

  -- Só incrementa se não for duplicado nas últimas 24h
  IF NOT has_recent_click THEN
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1,
        updated_at = NOW()
    WHERE id = increment_link_clicks.link_id;
  END IF;
END;
$$;

-- 3. Função para sincronizar todos os contadores (Manutenção)
CREATE OR REPLACE FUNCTION public.sync_all_link_clicks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links l
  SET clicks_count = (
    SELECT count(*)
    FROM public.clicks c
    WHERE c.link_id = l.id
  );
END;
$$;

-- 4. Executar sincronização inicial para limpar discrepâncias
SELECT public.sync_all_link_clicks();

-- 5. Garantir permissões
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_all_link_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;
