-- 1. Definir search_path para funções security definer e outras
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. Revogar execução pública de funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO service_role;

-- 3. Garantir que todas as tabelas com RLS tenham ao menos uma política (mesmo que restritiva se necessário)
-- user_roles já está com RLS mas sem política de leitura direta para usuários (apenas via has_role)
-- Vamos adicionar uma política para que usuários vejam seus próprios papéis se necessário, 
-- ou apenas manter via function. O linter reclama se não houver política.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Usuários podem ver seus próprios papéis') THEN
        CREATE POLICY "Usuários podem ver seus próprios papéis" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;
END
$$;
