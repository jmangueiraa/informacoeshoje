-- Corrigir avisos do linter para has_role
-- Revogar acesso público e restringir a authenticated/service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Garantir search_path seguro
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;