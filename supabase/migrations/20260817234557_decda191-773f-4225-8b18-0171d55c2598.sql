-- Revogar permissões públicas da função security definer para maior segurança
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM authenticated;

-- Garantir que o service_role ainda possa executar (usado via RPC no backend)
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;
