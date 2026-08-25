CREATE OR REPLACE FUNCTION public.normalize_contact_phone(raw_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH digits AS (
    SELECT regexp_replace(coalesce(raw_phone, ''), '\D', '', 'g') AS value
  )
  SELECT CASE
    WHEN value ~ '^(55){2,}' THEN regexp_replace(value, '^(55)+', '')
    WHEN value LIKE '55%' AND length(value) > 11 THEN substring(value from 3)
    WHEN value LIKE '0%' AND length(value) IN (11, 12) THEN substring(value from 2)
    ELSE value
  END
  FROM digits;
$$;

CREATE OR REPLACE FUNCTION public.normalize_contact_phone_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_normalized := public.normalize_contact_phone(NEW.phone_normalized);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_contacts_phone_before_write ON public.contacts;

CREATE TRIGGER normalize_contacts_phone_before_write
BEFORE INSERT OR UPDATE OF phone_normalized ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_contact_phone_trigger();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass
      AND conname = 'contacts_user_id_phone_normalized_key'
  ) THEN
    ALTER TABLE public.contacts
    ADD CONSTRAINT contacts_user_id_phone_normalized_key UNIQUE (user_id, phone_normalized);
  END IF;
END $$;