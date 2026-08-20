-- Adicionar colunas para melhor gestão de captura de contatos
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS review_reason TEXT,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Garantir que as permissões estejam atualizadas (embora GRANT table geralmente cubra novas colunas)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

-- Comentário para documentação
COMMENT ON COLUMN public.contacts.review_reason IS 'Motivo pelo qual o contato foi enviado para revisão';
COMMENT ON COLUMN public.contacts.needs_review IS 'Indica se o contato precisa de conferência manual';
COMMENT ON COLUMN public.contacts.raw_data IS 'Dados brutos retornados pela IA para auditoria';
