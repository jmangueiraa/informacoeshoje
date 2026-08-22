GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;

SELECT public.sync_all_link_clicks();

ALTER TABLE public.links REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'links'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.links';
  END IF;
END $$;