GRANT SELECT ON public.clicks TO authenticated;
GRANT INSERT ON public.clicks TO anon, authenticated;
GRANT ALL ON public.clicks TO service_role;