-- Migração para configurar administrador exclusivo
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Tentar encontrar o ID do usuário pelo e-mail
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'augusto_mangueira@hotmail.com';

    -- 2. Se o usuário existir, configurar como admin e remover outros
    IF target_user_id IS NOT NULL THEN
        -- Garantir que ele tenha a role 'admin'
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;

        -- Remover role 'admin' de qualquer outro usuário
        DELETE FROM public.user_roles
        WHERE role = 'admin' AND user_id <> target_user_id;
    END IF;
END $$;
