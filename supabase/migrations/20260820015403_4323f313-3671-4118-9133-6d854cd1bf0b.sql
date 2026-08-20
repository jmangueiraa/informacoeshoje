-- Criar a tabela de contatos
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_normalized TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Restrição UNIQUE fundamental: o mesmo número não pode ser repetido para o mesmo usuário
    UNIQUE (user_id, phone_normalized)
);

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

-- Habilitar RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view their own contacts"
    ON public.contacts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
    ON public.contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
    ON public.contacts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
    ON public.contacts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Criar índice para busca rápida por telefone normalizado e usuário
CREATE INDEX idx_contacts_user_phone ON public.contacts (user_id, phone_normalized);
CREATE INDEX idx_contacts_user_name ON public.contacts (user_id, name);
