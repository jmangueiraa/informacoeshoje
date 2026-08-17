-- 1. Tabela de Planos
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    max_links INTEGER NOT NULL DEFAULT 10,
    max_clicks INTEGER NOT NULL DEFAULT 1000,
    features JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plans TO anon;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Qualquer um pode ver planos ativos" ON public.plans FOR SELECT USING (active = true);

-- 2. Atualizar Profiles para suportar planos
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Tabela de Links
CREATE TABLE IF NOT EXISTS public.links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
    slug TEXT NOT NULL,
    affiliate_url TEXT NOT NULL,
    title TEXT,
    status TEXT DEFAULT 'active',
    clicks_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_links_slug ON public.links(slug);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON public.links(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT SELECT ON public.links TO anon; 
GRANT ALL ON public.links TO service_role;

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários gerenciam seus próprios links" ON public.links FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Público pode ver links para redirect" ON public.links FOR SELECT TO anon, authenticated USING (status = 'active');

-- 4. Tabela de Cliques (Analytics)
CREATE TABLE IF NOT EXISTS public.clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id UUID REFERENCES public.links(id) ON DELETE CASCADE NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    operating_system TEXT,
    referrer TEXT,
    approximate_location JSONB
);

CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON public.clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON public.clicks(clicked_at);

GRANT INSERT ON public.clicks TO anon, authenticated;
GRANT SELECT ON public.clicks TO authenticated;
GRANT ALL ON public.clicks TO service_role;

ALTER TABLE public.clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários vêem cliques de seus links" ON public.clicks FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.links WHERE id = clicks.link_id AND user_id = auth.uid())
);
CREATE POLICY "Qualquer um pode registrar clique" ON public.clicks FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 5. Tabela de Subscrições
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES public.plans(id) NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários vêem suas subscrições" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Inserir Planos Iniciais
INSERT INTO public.plans (name, price, max_links, max_clicks, features) VALUES
('Gratuito', 0.00, 10, 1000, '["Estatísticas básicas"]'),
('Pro', 49.90, 500, 100000, '["Estatísticas completas", "Links expirados"]'),
('Premium', 99.90, 999999, 999999999, '["Links ilimitados", "Domínio personalizado", "Suporte premium"]');
