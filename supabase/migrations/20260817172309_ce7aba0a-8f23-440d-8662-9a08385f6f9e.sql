-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Usuários gerenciam seus próprios links" ON public.links;

-- Create a robust policy for all operations
CREATE POLICY "Usuários gerenciam seus próprios links" 
ON public.links 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure grants are correct for all columns
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT ON public.links TO anon;
GRANT ALL ON public.links TO service_role;
