-- Migration: Correção e sincronização da tabela ip_cooldown
-- Garante a existência de todas as colunas necessárias (slug, link_id, user_id)
-- e realiza o backfill de IPs registrados em clicks e link_clicks.

-- 1. Garante que a tabela ip_cooldown existe e possui todas as colunas
CREATE TABLE IF NOT EXISTS public.ip_cooldown (
  ip_address text PRIMARY KEY,
  last_click_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  slug text,
  link_id uuid REFERENCES public.links(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Adiciona as colunas caso a tabela já existisse sem elas
ALTER TABLE public.ip_cooldown ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.ip_cooldown ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES public.links(id) ON DELETE SET NULL;
ALTER TABLE public.ip_cooldown ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_ip_cooldown_last_click ON public.ip_cooldown (ip_address, last_click_at);
CREATE INDEX IF NOT EXISTS idx_ip_cooldown_link_id ON public.ip_cooldown (link_id);
CREATE INDEX IF NOT EXISTS idx_ip_cooldown_slug ON public.ip_cooldown (slug);

-- 3. Habilita RLS e permissões completas
ALTER TABLE public.ip_cooldown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura ip_cooldown" ON public.ip_cooldown;
CREATE POLICY "Permitir leitura ip_cooldown"
ON public.ip_cooldown FOR SELECT
TO anon, authenticated, service_role
USING (true);

DROP POLICY IF EXISTS "Permitir operacoes ip_cooldown" ON public.ip_cooldown;
CREATE POLICY "Permitir operacoes ip_cooldown"
ON public.ip_cooldown FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

GRANT ALL ON public.ip_cooldown TO anon, authenticated, service_role;
GRANT ALL ON public.clicks TO anon, authenticated, service_role;
GRANT ALL ON public.link_clicks TO anon, authenticated, service_role;

-- 4. Função RPC process_shopee_click atualizada e resiliente
CREATE OR REPLACE FUNCTION public.process_shopee_click(
  p_slug text,
  p_ip text,
  p_has_cookie boolean DEFAULT false,
  p_is_bot boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_slug text;
  v_link record;
  v_in_cooldown boolean := false;
  v_dest_url text;
  v_is_valid boolean := false;
  v_effective_ip text;
BEGIN
  -- 1. Sanitização do slug (remove barras e prefixos)
  v_clean_slug := lower(btrim(p_slug, '/'));
  IF v_clean_slug LIKE 'arquivos/%' THEN
    v_clean_slug := substr(v_clean_slug, 10);
  END IF;
  IF v_clean_slug LIKE 'loja/%' THEN
    v_clean_slug := substr(v_clean_slug, 6);
  END IF;

  v_effective_ip := NULLIF(btrim(p_ip), '');
  IF v_effective_ip = 'visitor' THEN
    v_effective_ip := NULL;
  END IF;

  -- 2. Localização do link ativo no banco
  SELECT id, user_id, affiliate_url, destination_url, url_destino, status, expires_at, clicks_count
  INTO v_link
  FROM public.links
  WHERE (
    lower(btrim(slug, '/')) = v_clean_slug OR
    lower(btrim(slug, '/')) = 'arquivos/' || v_clean_slug OR
    lower(btrim(slug, '/')) = 'loja/' || v_clean_slug OR
    slug ILIKE v_clean_slug OR
    slug ILIKE 'loja/' || v_clean_slug OR
    slug ILIKE 'arquivos/' || v_clean_slug
  )
    AND (status = 'active' OR status IS NULL)
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  -- Se não encontrar o link ativo, retorna erro
  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'destination_url', NULL,
      'is_valid_click', false,
      'error', 'Link não encontrado ou expirado'
    );
  END IF;

  v_dest_url := COALESCE(v_link.affiliate_url, v_link.destination_url, v_link.url_destino);

  -- Se for Bot ou crawler, apenas retorna a URL sem registrar clique nem cooldown
  IF p_is_bot IS TRUE THEN
    RETURN jsonb_build_object(
      'success', true,
      'destination_url', v_dest_url,
      'is_valid_click', false,
      'in_cooldown', false,
      'link_id', v_link.id
    );
  END IF;

  -- 3. Checagem 1 (Cookie de 7 dias do navegador):
  IF p_has_cookie IS TRUE THEN
    v_in_cooldown := true;
  END IF;

  -- 4. Checagem 2 (IP no Supabase na janela de 7 dias):
  IF v_in_cooldown IS FALSE AND v_effective_ip IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 
      FROM public.ip_cooldown 
      WHERE ip_address = v_effective_ip 
        AND last_click_at > (now() - INTERVAL '7 days')
    ) THEN
      v_in_cooldown := true;
    END IF;
  END IF;

  -- 5. Se NÃO estiver em quarentena (clique válido e contabilizável):
  IF v_in_cooldown IS FALSE THEN
    v_is_valid := true;

    -- Incrementa contagem de cliques do link
    UPDATE public.links
    SET clicks_count = COALESCE(clicks_count, 0) + 1
    WHERE id = v_link.id;

    -- Registra na tabela de clicks
    INSERT INTO public.clicks (link_id, ip_address, slug, clicked_at)
    VALUES (v_link.id, COALESCE(v_effective_ip, 'visitor'), v_clean_slug, now());

    -- Registra na tabela link_clicks
    INSERT INTO public.link_clicks (link_id, ip_address, created_at)
    VALUES (v_link.id, COALESCE(v_effective_ip, 'visitor'), now());

    -- Atualiza ou insere IP na quarentena
    IF v_effective_ip IS NOT NULL THEN
      INSERT INTO public.ip_cooldown (ip_address, last_click_at, created_at, slug, link_id, user_id)
      VALUES (v_effective_ip, now(), now(), v_clean_slug, v_link.id, v_link.user_id)
      ON CONFLICT (ip_address) 
      DO UPDATE SET 
        last_click_at = EXCLUDED.last_click_at,
        slug = EXCLUDED.slug,
        link_id = EXCLUDED.link_id,
        user_id = COALESCE(EXCLUDED.user_id, ip_cooldown.user_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'destination_url', v_dest_url,
    'is_valid_click', v_is_valid,
    'in_cooldown', v_in_cooldown,
    'link_id', v_link.id
  );
END;
$$;

-- 5. Backfill automático: sincroniza registros recentes da tabela clicks para ip_cooldown
DO $$
BEGIN
  INSERT INTO public.ip_cooldown (ip_address, last_click_at, created_at, slug, link_id)
  SELECT 
    c.ip_address, 
    MAX(c.clicked_at) as last_click_at, 
    MIN(c.clicked_at) as created_at, 
    c.slug,
    c.link_id
  FROM public.clicks c
  WHERE c.ip_address IS NOT NULL 
    AND c.ip_address != '' 
    AND c.ip_address != 'visitor'
  GROUP BY c.ip_address, c.slug, c.link_id
  ON CONFLICT (ip_address) 
  DO UPDATE SET 
    last_click_at = GREATEST(ip_cooldown.last_click_at, EXCLUDED.last_click_at),
    slug = COALESCE(EXCLUDED.slug, ip_cooldown.slug),
    link_id = COALESCE(EXCLUDED.link_id, ip_cooldown.link_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
