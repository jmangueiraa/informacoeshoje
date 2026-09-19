-- ==============================================================================
-- MIGRATION: SuperAdmin SaaS Billing, Mercado Pago & Telegram Bot Integration
-- ==============================================================================

-- 1. Atualizar a tabela de profiles com campos de assinatura, telefone e notas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_price NUMERIC(10,2) DEFAULT 30.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Tabela de Configurações Administrativas (Mercado Pago & Telegram)
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    mercadopago_access_token TEXT,
    mercadopago_public_key TEXT,
    mercadopago_webhook_secret TEXT,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    default_monthly_price NUMERIC(10,2) DEFAULT 30.00,
    pix_key TEXT,
    support_whatsapp TEXT DEFAULT '5519981356505',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Inserir registro inicial caso não exista
INSERT INTO public.admin_settings (id, default_monthly_price, support_whatsapp)
VALUES (1, 30.00, '5519981356505')
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, UPDATE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Apenas administradores podem gerenciar admin_settings') THEN
        CREATE POLICY "Apenas administradores podem gerenciar admin_settings"
        ON public.admin_settings FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
            )
        );
    END IF;
END
$$;

-- 3. Tabela de Pedidos e Cobranças (Payment Orders)
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    mercadopago_payment_id TEXT,
    amount NUMERIC(10,2) NOT NULL DEFAULT 30.00,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
    payment_method TEXT DEFAULT 'pix',
    qr_code TEXT,
    qr_code_base64 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_mp_id ON public.payment_orders(mercadopago_payment_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Usuários podem ver seus próprios pedidos') THEN
        CREATE POLICY "Usuários podem ver seus próprios pedidos"
        ON public.payment_orders FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Usuários podem criar pedidos') THEN
        CREATE POLICY "Usuários podem criar pedidos"
        ON public.payment_orders FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 4. Atualizar a trigger de novos usuários para definir Teste de 7 Dias por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
    v_is_admin BOOLEAN := FALSE;
BEGIN
    -- Verificar se é o email do SuperAdmin Master
    IF LOWER(NEW.email) = 'ajpentretedimento@hotmail.com' THEN
        v_is_admin := TRUE;
    END IF;

    -- Buscar o ID do plano gratuito se existir
    SELECT id INTO free_plan_id FROM public.plans WHERE name = 'Gratuito' LIMIT 1;

    INSERT INTO public.profiles (
        id, 
        full_name, 
        avatar_url, 
        plan_id, 
        is_trial, 
        trial_expires_at,
        subscription_type,
        subscription_price,
        subscription_status,
        subscription_expires_at,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id, 
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'avatar_url',
        free_plan_id,
        CASE WHEN v_is_admin THEN FALSE ELSE TRUE END,
        CASE WHEN v_is_admin THEN (NOW() + INTERVAL '10 years') ELSE (NOW() + INTERVAL '7 days') END,
        CASE WHEN v_is_admin THEN 'lifetime' ELSE 'trial_7d' END,
        30.00,
        CASE WHEN v_is_admin THEN 'active' ELSE 'trial' END,
        CASE WHEN v_is_admin THEN (NOW() + INTERVAL '10 years') ELSE (NOW() + INTERVAL '7 days') END,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        subscription_type = EXCLUDED.subscription_type,
        subscription_status = EXCLUDED.subscription_status,
        subscription_expires_at = EXCLUDED.subscription_expires_at;
    
    -- Inserir role de admin se for o email master, senão user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC para renovação atômica de assinatura pelo SuperAdmin ou Webhook
CREATE OR REPLACE FUNCTION public.superadmin_renew_subscription(
    p_user_id UUID,
    p_days_to_add INTEGER DEFAULT 30,
    p_new_price NUMERIC DEFAULT 30.00,
    p_new_type TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_expires TIMESTAMP WITH TIME ZONE;
    v_new_expires TIMESTAMP WITH TIME ZONE;
    v_result JSONB;
BEGIN
    SELECT subscription_expires_at INTO v_current_expires
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_current_expires IS NULL OR v_current_expires < NOW() THEN
        v_new_expires := NOW() + (p_days_to_add || ' days')::INTERVAL;
    ELSE
        v_new_expires := v_current_expires + (p_days_to_add || ' days')::INTERVAL;
    END IF;

    INSERT INTO public.profiles (
        id,
        subscription_expires_at,
        trial_expires_at,
        subscription_status,
        subscription_type,
        subscription_price,
        is_trial,
        updated_at
    )
    VALUES (
        p_user_id,
        v_new_expires,
        v_new_expires,
        'active',
        COALESCE(p_new_type, 'monthly'),
        COALESCE(p_new_price, 30.00),
        FALSE,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        subscription_expires_at = EXCLUDED.subscription_expires_at,
        trial_expires_at = EXCLUDED.trial_expires_at,
        subscription_status = EXCLUDED.subscription_status,
        subscription_type = EXCLUDED.subscription_type,
        subscription_price = EXCLUDED.subscription_price,
        is_trial = EXCLUDED.is_trial,
        updated_at = NOW();

    v_result := jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'new_expires_at', v_new_expires,
        'status', 'active',
        'days_added', p_days_to_add
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.superadmin_renew_subscription TO authenticated, service_role;

-- 6. Retroactive Backfill para perfis já existentes no banco de dados
UPDATE public.profiles
SET 
    subscription_expires_at = COALESCE(subscription_expires_at, created_at + INTERVAL '30 days', NOW() + INTERVAL '30 days'),
    subscription_status = COALESCE(subscription_status, 'active'),
    subscription_type = CASE 
        WHEN id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin') THEN 'lifetime' 
        ELSE COALESCE(subscription_type, 'monthly') 
    END,
    subscription_price = CASE 
        WHEN id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin') THEN 0.00 
        ELSE COALESCE(subscription_price, 30.00) 
    END
WHERE subscription_expires_at IS NULL;
