-- Corrigindo avisos do linter de segurança

-- 1. Garantir search_path em increment_link_clicks
ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;

-- 2. Garantir search_path em sync_all_link_clicks
ALTER FUNCTION public.sync_all_link_clicks() SET search_path = public;

-- 3. Garantir que as funções NÃO sejam executáveis por usuários autenticados/anon
-- (O linter pode ter detectado permissões residuais ou padrões)
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_all_link_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;
