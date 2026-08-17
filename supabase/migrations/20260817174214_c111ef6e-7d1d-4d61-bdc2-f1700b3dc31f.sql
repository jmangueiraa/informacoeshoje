-- Adicionar colunas de API à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shopee_app_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shopee_app_secret TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shopee_api_key TEXT;

-- Garantir que as permissões estejam corretas (mesmo que já devessem estar)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;