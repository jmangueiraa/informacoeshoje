-- Corrigindo avisos do linter de segurança e garantindo search_path

-- 1. Garantir search_path em increment_link_clicks para evitar vulnerabilidades de path mutable
ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;

-- 2. Garantir search_path em sync_all_link_clicks
ALTER FUNCTION public.sync_all_link_clicks() SET search_path = public;

-- 3. Reforçar restrições de execução (apenas backend/service_role pode chamar)
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_all_link_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;
