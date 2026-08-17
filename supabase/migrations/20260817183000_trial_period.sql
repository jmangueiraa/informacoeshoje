-- 1. Adicionar colunas de trial ao profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

-- 2. Atualizar a trigger handle_new_user para incluir o período de trial de 24 horas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Buscar o ID do plano gratuito
    SELECT id INTO free_plan_id FROM public.plans WHERE name = 'Gratuito' LIMIT 1;

    INSERT INTO public.profiles (
        id, 
        full_name, 
        avatar_url, 
        plan_id, 
        is_trial, 
        trial_expires_at
    )
    VALUES (
        NEW.id, 
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'avatar_url',
        free_plan_id,
        TRUE,
        NOW() + INTERVAL '24 hours'
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT UPDATE ON public.profiles TO authenticated;
