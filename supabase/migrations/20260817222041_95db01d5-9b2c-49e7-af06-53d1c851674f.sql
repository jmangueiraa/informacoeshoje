-- A migração anterior falhou porque a coluna is_trial pode não existir ou ter outro nome.
-- Vamos primeiro verificar a estrutura e depois remover o que não for necessário ou apenas limpar os dados.

-- Limpar referências a planos e trial (ignorando erros de coluna inexistente)
DO $$
BEGIN
    BEGIN
        UPDATE public.profiles SET is_trial = false;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;
    
    BEGIN
        UPDATE public.profiles SET trial_expires_at = NULL;
    EXCEPTION WHEN undefined_column THEN
        NULL;
    END;
END $$;

-- Garantir acesso total
GRANT ALL ON public.links TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
