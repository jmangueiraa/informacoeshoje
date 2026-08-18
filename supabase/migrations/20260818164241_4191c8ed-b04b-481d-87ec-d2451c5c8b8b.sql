
-- Atualizar o domínio principal nos perfis dos usuários
UPDATE public.profiles 
SET custom_domain = 'infomacoeshoje.online' 
WHERE custom_domain = 'informaçãohoje.com.br' 
   OR custom_domain = 'informacoeshoje.lovable.app'
   OR custom_domain IS NULL;

-- Garantir que o domínio infomacoeshoje.online esteja registrado para o admin e verificado
DO $$
DECLARE
    admin_id UUID := '068b5633-ae0a-4119-93ca-fff170d3973f';
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_domains') THEN
        INSERT INTO public.user_domains (user_id, domain, is_verified, is_primary, verification_status)
        VALUES (admin_id, 'infomacoeshoje.online', true, true, 'verified')
        ON CONFLICT (domain) DO UPDATE SET 
            is_verified = true, 
            is_primary = true, 
            verification_status = 'verified';
    END IF;
END $$;
