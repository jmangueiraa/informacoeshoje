-- 1. Definir explicitamente o search_path para evitar mutabilidade (WARN 1)
-- 2. Revogar explicitamente a permissão de execução de PUBLIC e authenticated para SECURITY DEFINER (WARN 2)
-- A função já foi criada, então apenas ajustamos as propriedades e permissões.

ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;
