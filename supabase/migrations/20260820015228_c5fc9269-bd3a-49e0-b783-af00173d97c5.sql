-- 1. Corrigir a função has_role (Linter 0011 e 0029)
-- Define explicitamente o search_path e restringe execução
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
COMMENT ON FUNCTION public.has_role(uuid, app_role) IS 'Função interna de segurança para verificar permissões. Apenas service_role deve executar.';

-- 2. Corrigir a função increment_link_clicks (Linter 0011 e 0029)
-- Embora já tenha search_path em algumas versões, vamos padronizar
-- Nota: anon e authenticated precisam de EXECUTE porque o redirecionador usa a API do Supabase (via server functions ou client direto)
ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO anon, authenticated, service_role;

-- Se existir a versão antiga da função (com apenas 1 parâmetro), corrigimos também
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_link_clicks' AND pronargs = 1) THEN
        ALTER FUNCTION public.increment_link_clicks(uuid) SET search_path = public;
        REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid) TO anon, authenticated, service_role;
    END IF;
END $$;