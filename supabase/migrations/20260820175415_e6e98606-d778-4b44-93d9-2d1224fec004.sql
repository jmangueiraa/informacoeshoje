-- Permitir que usuários autenticados possam atualizar e excluir contatos
-- Visto que a visualização e inserção já são permitidas para todos os autenticados

DROP POLICY IF EXISTS "Admins can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

CREATE POLICY "Authenticated users can update contacts"
ON public.contacts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete contacts"
ON public.contacts FOR DELETE
TO authenticated
USING (true);

-- Garantir privilégios
GRANT ALL ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
