DO $$
DECLARE
    admin_id UUID;
    target_email TEXT := 'ajpentretedimento@hotmail.com';
BEGIN
    -- 1. Obter o ID do usuário que deve permanecer como admin
    SELECT id INTO admin_id FROM auth.users WHERE email = target_email;

    IF admin_id IS NOT NULL THEN
        -- 2. Remover o papel 'admin' de todos os outros usuários na tabela user_roles
        -- A role 'admin' é do tipo app_role (admin, moderator, user)
        DELETE FROM public.user_roles 
        WHERE role = 'admin' 
        AND user_id != admin_id;

        -- 3. Garantir que o usuário alvo tenha o papel 'admin'
        INSERT INTO public.user_roles (user_id, role)
        VALUES (admin_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
        
    ELSE
        RAISE EXCEPTION 'Usuário % não encontrado no sistema.', target_email;
    END IF;
END $$;