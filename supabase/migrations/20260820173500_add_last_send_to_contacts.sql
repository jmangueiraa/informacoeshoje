-- Add last_send column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_send TIMESTAMPTZ;

-- Update RLS grants to ensure it's accessible (though usually already covered by GRANT ALL)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
