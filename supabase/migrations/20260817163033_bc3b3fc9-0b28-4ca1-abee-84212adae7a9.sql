-- Ajustar a função increment_link_clicks para maior segurança
-- Embora já tenha search_path = public, vamos garantir que apenas as roles necessárias possam executar.
-- Cliques são registrados via redirect (anon), então anon precisa de EXECUTE.
-- Mas vamos restringir o acesso geral e documentar.

ALTER FUNCTION public.increment_link_clicks(UUID) SECURITY DEFINER SET search_path = public;

-- Revogar permissões e conceder apenas as necessárias
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(UUID) TO anon, authenticated, service_role;
