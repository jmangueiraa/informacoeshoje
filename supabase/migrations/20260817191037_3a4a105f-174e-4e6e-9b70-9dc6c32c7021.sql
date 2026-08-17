-- Atualizar a tabela user_domains com os novos campos
ALTER TABLE public.user_domains 
ADD COLUMN IF NOT EXISTS domain_type text CHECK (domain_type IN ('subdomain', 'custom')) DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS verification_status text CHECK (verification_status IN ('pending', 'verified', 'failed')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Adicionar restrição UNIQUE para o domínio se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_domains_domain_key') THEN
        ALTER TABLE public.user_domains ADD CONSTRAINT user_domains_domain_key UNIQUE (domain);
    END IF;
END $$;

-- Garantir que apenas um domínio por usuário seja is_primary
CREATE UNIQUE INDEX IF NOT EXISTS user_domains_single_primary_idx ON public.user_domains (user_id) WHERE (is_primary = true);

-- Habilitar RLS
ALTER TABLE public.user_domains ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view their own domains" ON public.user_domains;
CREATE POLICY "Users can view their own domains" 
ON public.user_domains FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own domains" ON public.user_domains;
CREATE POLICY "Users can insert their own domains" 
ON public.user_domains FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own domains" ON public.user_domains;
CREATE POLICY "Users can update their own domains" 
ON public.user_domains FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own domains" ON public.user_domains;
CREATE POLICY "Users can delete their own domains" 
ON public.user_domains FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Grants
GRANT ALL ON public.user_domains TO authenticated;
GRANT ALL ON public.user_domains TO service_role;
GRANT SELECT ON public.user_domains TO anon;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_domains_updated_at
    BEFORE UPDATE ON public.user_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
