-- Remover políticas restritivas de admin para contatos
DROP POLICY IF EXISTS "Admins can view contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON public.contacts;

-- Permitir que todos os usuários autenticados vejam os contatos
-- (A lógica de negócio atual sugere uma lista global compartilhada ou capturada por todos)
CREATE POLICY "Authenticated users can view contacts"
ON public.contacts FOR SELECT
TO authenticated
USING (true);

-- Permitir que todos os usuários autenticados insiram contatos (via OCR/IA)
CREATE POLICY "Authenticated users can insert contacts"
ON public.contacts FOR INSERT
TO authenticated
WITH CHECK (true);

-- Manter edição e exclusão restritas a administradores (Segurança)
CREATE POLICY "Admins can update contacts"
ON public.contacts FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete contacts"
ON public.contacts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
