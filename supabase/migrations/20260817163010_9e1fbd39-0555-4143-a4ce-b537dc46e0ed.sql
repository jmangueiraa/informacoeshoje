-- Adicionar suporte a domínios personalizados no LinkShopee

-- 1. Adicionar coluna custom_domain em links
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- 2. Adicionar coluna custom_domain em profiles (domínio padrão do usuário)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- 3. Tabela para gerenciar múltiplos domínios por usuário
CREATE TABLE IF NOT EXISTS public.user_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_domains TO authenticated;
GRANT ALL ON public.user_domains TO service_role;

ALTER TABLE public.user_domains ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_domains' AND policyname = 'Usuários gerenciam seus próprios domínios'
    ) THEN
        CREATE POLICY "Usuários gerenciam seus próprios domínios" 
        ON public.user_domains FOR ALL TO authenticated 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Atualizar grants para garantir acesso às novas colunas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT ON public.links TO anon; 
