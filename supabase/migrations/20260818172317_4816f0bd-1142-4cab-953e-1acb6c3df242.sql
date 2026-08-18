DO $$
DECLARE
    new_user_id UUID;
    target_email TEXT := 'ajpentretedimento@hotmail.com';
    target_pass TEXT := '30101695';
BEGIN
    -- 1. Verificar se o usuário já existe no auth.users
    SELECT id INTO new_user_id FROM auth.users WHERE email = target_email;

    -- 2. Se não existir, criar o usuário
    IF new_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            target_email,
            crypt(target_pass, gen_salt('bf')),
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"AJP Entretenimento"}',
            false,
            now(),
            now(),
            '',
            '',
            '',
            ''
        )
        RETURNING id INTO new_user_id;
    END IF;

    -- 3. Garantir que o perfil existe em public.profiles
    INSERT INTO public.profiles (id, full_name)
    VALUES (new_user_id, 'AJP Entretenimento')
    ON CONFLICT (id) DO UPDATE SET full_name = 'AJP Entretenimento';

    -- 4. Adicionar role 'admin' na public.user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

END $$;