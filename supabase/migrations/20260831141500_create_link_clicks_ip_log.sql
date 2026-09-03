-- 1. Cria a tabela de registro de cliques por IP
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES public.links(id) ON DELETE CASCADE,
  ip_address text NOT NULL,
  created_at timestamp WITH time zone DEFAULT now()
);

-- 2. Índice para buscas rápidas por IP e link
CREATE INDEX IF NOT EXISTS idx_link_clicks_lookup 
ON public.link_clicks(link_id, ip_address, created_at);

-- 3. Habilita RLS e libera acesso para visitantes anônimos e autenticados
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de cliques" ON public.link_clicks;
CREATE POLICY "Permitir leitura de cliques"
ON public.link_clicks FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Permitir insercao de cliques" ON public.link_clicks;
CREATE POLICY "Permitir insercao de cliques"
ON public.link_clicks FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir delecao de cliques pelo dono do link" ON public.link_clicks;
CREATE POLICY "Permitir delecao de cliques pelo dono do link"
ON public.link_clicks FOR DELETE
TO anon, authenticated
USING (true);

GRANT SELECT, INSERT, DELETE ON public.link_clicks TO anon, authenticated;
GRANT ALL ON public.link_clicks TO service_role;

GRANT SELECT, INSERT, DELETE ON public.clicks TO anon, authenticated;

-- 4. Função com SECURITY DEFINER para registrar o clique e atualizar o contador de forma atômica
CREATE OR REPLACE FUNCTION public.register_link_click(p_link_id uuid, p_ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_clicked boolean;
BEGIN
  -- Verifica se este IP já clicou nas últimas 24 horas neste link
  SELECT EXISTS (
    SELECT 1 FROM public.link_clicks
    WHERE link_id = p_link_id
      AND ip_address = p_ip
      AND created_at > (now() - interval '24 hours')
  ) INTO v_already_clicked;

  -- Se já clicou nas últimas 24h, não soma novamente
  IF v_already_clicked THEN
    RETURN false;
  END IF;

  -- Se for novo clique, registra o IP
  INSERT INTO public.link_clicks (link_id, ip_address)
  VALUES (p_link_id, p_ip);

  -- Registra na tabela clicks para manter compatibilidade com relatórios/gráficos
  INSERT INTO public.clicks (link_id, ip_address)
  VALUES (p_link_id, p_ip);

  -- Incrementa o contador na tabela links
  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = now()
  WHERE id = p_link_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_link_click(uuid, text) TO anon, authenticated, service_role;

-- 5. Função com SECURITY DEFINER para zerar os cliques de um link
CREATE OR REPLACE FUNCTION public.reset_link_clicks(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Zera contador na tabela links
  UPDATE public.links
  SET clicks_count = 0,
      updated_at = now()
  WHERE id = p_link_id;

  -- 2. Limpa registros nas tabelas de cliques
  DELETE FROM public.clicks WHERE link_id = p_link_id;
  DELETE FROM public.link_clicks WHERE link_id = p_link_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_link_clicks(uuid) TO anon, authenticated, service_role;

-- 6. Função de incremento simples (compatibilidade)
CREATE OR REPLACE FUNCTION public.increment_clicks(row_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = now()
  WHERE id = row_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_clicks(uuid) TO anon, authenticated, service_role;

-- 7. Função de incremento por Slug (Case-Insensitive e flexível a barras)
CREATE OR REPLACE FUNCTION public.incrementar_clique(link_slug text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  url_dest text;
  v_link_id uuid;
  v_clean_slug text;
BEGIN
  v_clean_slug := lower(btrim(link_slug, '/'));

  UPDATE public.links
  SET clicks_count = COALESCE(clicks_count, 0) + 1,
      updated_at = now()
  WHERE lower(btrim(slug, '/')) = v_clean_slug
    AND (status = 'active' OR status IS NULL)
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING id, affiliate_url INTO v_link_id, url_dest;

  IF v_link_id IS NOT NULL THEN
    INSERT INTO public.clicks (link_id) VALUES (v_link_id);
  END IF;

  RETURN url_dest;
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_clique(text) TO anon, authenticated, service_role;

