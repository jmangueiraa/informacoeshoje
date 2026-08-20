-- Adiciona constraint UNIQUE composta por (user_id, phone_normalized) se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'contacts_user_id_phone_normalized_key'
    ) THEN
        ALTER TABLE public.contacts 
        ADD CONSTRAINT contacts_user_id_phone_normalized_key UNIQUE (user_id, phone_normalized);
    END IF;
END $$;
