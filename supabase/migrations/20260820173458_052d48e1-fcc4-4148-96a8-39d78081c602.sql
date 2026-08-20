-- Add last_send column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_send TIMESTAMPTZ;

-- Ensure RLS grants are correct
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;