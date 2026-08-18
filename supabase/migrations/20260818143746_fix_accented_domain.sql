-- Fix the domain to use the accented version as seen in user's screenshots
-- The Punycode xn--informaohoje-8bb9c.com.br resolves to informaçãohoje.com.br

DO $$ 
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the user_id from the existing incorrect domain
    SELECT user_id INTO v_user_id FROM public.user_domains WHERE domain = 'www.informacaohoje.com.br' LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- Insert or Update base domain
        INSERT INTO public.user_domains (user_id, domain, domain_type, verification_status, is_primary)
        VALUES (v_user_id, 'informaçãohoje.com.br', 'custom', 'verified', true)
        ON CONFLICT (domain) DO UPDATE SET verification_status = 'verified', is_primary = true;

        -- Insert or Update www domain
        INSERT INTO public.user_domains (user_id, domain, domain_type, verification_status, is_primary)
        VALUES (v_user_id, 'www.informaçãohoje.com.br', 'custom', 'verified', false)
        ON CONFLICT (domain) DO UPDATE SET verification_status = 'verified';
        
        -- Update profile primary domain
        UPDATE public.profiles SET custom_domain = 'informaçãohoje.com.br' WHERE id = v_user_id;
    END IF;
END $$;
