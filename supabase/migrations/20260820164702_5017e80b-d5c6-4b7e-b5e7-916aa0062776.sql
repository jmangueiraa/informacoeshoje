-- Revogar explicitamente o acesso de todos os papéis e garantir apenas para o service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- Já fizemos isso para increment_link_clicks, mas vamos reforçar
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;