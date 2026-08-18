-- 1. Corrigir has_role (search_path e permissões)
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- 2. Corrigir increment_link_clicks (garantir que as permissões foram aplicadas corretamente)
ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;

-- 3. Corrigir handle_new_user (trigger da auth)
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
