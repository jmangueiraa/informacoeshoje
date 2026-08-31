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

-- 3. RLS e permissões para link_clicks
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para autenticados e anonimos" ON public.link_clicks;
CREATE POLICY "Permitir leitura para autenticados e anonimos" ON public.link_clicks
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir insercao de cliques" ON public.link_clicks;
CREATE POLICY "Permitir insercao de cliques" ON public.link_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.link_clicks TO anon, authenticated;
GRANT ALL ON public.link_clicks TO service_role;

-- 4. Função de incremento atômico de cliques
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
