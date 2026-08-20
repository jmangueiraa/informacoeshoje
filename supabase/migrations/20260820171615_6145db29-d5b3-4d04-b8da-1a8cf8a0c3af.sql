DO $$
DECLARE
    admin_id UUID;
    target_email TEXT := 'ajpentretedimento@hotmail.com';
BEGIN
    -- 1. Obter o ID do usuário que deve ser o único admin
    SELECT id INTO admin_id FROM auth.users WHERE email = target_email;

    IF admin_id IS NOT NULL THEN
        -- 2. Remover a role 'admin' de TODOS os usuários
        DELETE FROM public.user_roles WHERE role = 'admin';

        -- 3. Atribuir a role 'admin' apenas ao usuário alvo
        INSERT INTO public.user_roles (user_id, role)
        VALUES (admin_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;