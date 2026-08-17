-- Adicionar coluna domain_id na tabela links se não existir
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS domain_id uuid REFERENCES public.user_domains(id) ON DELETE SET NULL;

-- Grants atualizados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;
GRANT SELECT ON public.links TO anon;
