-- Forçar a revogação de permissões para garantir que o linter pare de reclamar
-- O linter às vezes é sensível a permissões residuais no esquema public

-- has_role precisa ser executável por usuários autenticados para as políticas de RLS funcionarem
-- Mas vamos garantir que o search_path e a estrutura estejam 100% corretos
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;

-- increment_link_clicks só deve ser acessível pelo service_role (backend)
ALTER FUNCTION public.increment_link_clicks(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;

-- handle_new_user é interna
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Sincronizar clicks_count novamente por segurança
UPDATE public.links l
SET clicks_count = (
  SELECT count(*) 
  FROM public.clicks c 
  WHERE c.link_id = l.id
);
