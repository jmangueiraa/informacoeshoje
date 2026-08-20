-- 1. has_role: Deve ser executado apenas por service_role (usado em RLS e funções de servidor autenticadas)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- 2. handle_new_user: Usada apenas por triggers internos do banco (auth)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 3. sync_all_link_clicks: Tarefa administrativa, apenas service_role
REVOKE ALL ON FUNCTION public.sync_all_link_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;

-- 4. increment_link_clicks: Usada pelos redirecionamentos (pode ser anon ou auth dependendo de como o redirecionamento é chamado)
-- Mantemos anon e authenticated para garantir que a API de dados possa chamar a função se necessário, 
-- mas revogamos de PUBLIC.
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO anon, authenticated, service_role;

-- Limpeza de search_path pendente em handle_new_user e sync_all_link_clicks
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.sync_all_link_clicks() SET search_path = public;