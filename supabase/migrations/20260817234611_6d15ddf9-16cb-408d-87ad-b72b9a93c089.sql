-- Corrigir search_path e permissões para has_role
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Corrigir search_path e permissões para handle_new_user (trigger da auth)
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
-- handle_new_user é chamada pelo Postgres trigger, geralmente não precisa de grants explícitos de anon/auth

-- Limpar a função increment_link_clicks legada (se existir com apenas 1 parâmetro)
DROP FUNCTION IF EXISTS public.increment_link_clicks(uuid);
