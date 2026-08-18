-- 1. Limpar domínios que não fazem mais sentido ou estão duplicados/errados
DELETE FROM public.user_domains 
WHERE domain IN ('ajpvip.com.br', 'noticiasviraisctv.lovable.app', 'informacaohoje.com.br', 'www.informacaohoje.com.br', 'informaçãohoje.com.br', 'www.informaçãohoje.com.br');

-- 2. Garantir que o domínio infomacoeshoje.online esteja verificado e seja o principal para o admin
-- ID do admin: 068b5633-ae0a-4119-93ca-fff170d3973f
INSERT INTO public.user_domains (user_id, domain, domain_type, is_verified, is_primary, verification_status)
VALUES 
  ('068b5633-ae0a-4119-93ca-fff170d3973f', 'infomacoeshoje.online', 'custom', true, true, 'verified'),
  ('068b5633-ae0a-4119-93ca-fff170d3973f', 'www.infomacoeshoje.online', 'custom', true, false, 'verified')
ON CONFLICT (domain) DO UPDATE SET 
  is_verified = true, 
  is_primary = EXCLUDED.is_primary,
  verification_status = 'verified';

-- 3. Atualizar o perfil do administrador para usar o domínio customizado
UPDATE public.profiles 
SET custom_domain = 'infomacoeshoje.online' 
WHERE id = '068b5633-ae0a-4119-93ca-fff170d3973f';

-- 4. Garantir que a Beatriz Costa também tenha o domínio configurado se for admin
UPDATE public.profiles 
SET custom_domain = 'infomacoeshoje.online' 
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');