REVOKE ALL ON FUNCTION public.incrementar_clique(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_clique(text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_all_link_clicks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_link_clicks() TO service_role;

REVOKE ALL ON FUNCTION public.increment_link_clicks(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_link_clicks(uuid, text) TO service_role;