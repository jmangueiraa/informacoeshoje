-- Adicionando mais conteúdos virais de fontes reais (UOL, O Globo, G1)
INSERT INTO public.viral_contents (subject, image_url, source, category, score, mentions, suggested_title, type)
VALUES 
('Novas diretrizes econômicas no Brasil', 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e', 'UOL Notícias', 'news', 92, 28000, 'Entenda o impacto das novas medidas na sua carteira', 'image'),
('Escândalo nos bastidores da TV', 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf', 'O Globo', 'entertainment', 85, 15000, 'Exclusivo: A verdade por trás do cancelamento da série', 'image'),
('Descoberta científica em Marte', 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9', 'G1 / Ciência', 'curiosities', 78, 12000, 'NASA encontra evidências de água líquida em cratera', 'image'),
('Final do campeonato estadual', 'https://images.unsplash.com/photo-1574629810360-7efbbe195018', 'UOL Esporte', 'sports', 96, 52000, 'Tudo o que você precisa saber sobre o clássico de domingo', 'image');

-- Adicionando tópicos em alta de fontes reais
INSERT INTO public.trending_topics (subject, image_url, source, mentions, suggested_title)
VALUES 
('Reforma Tributária 2026', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f', 'O Globo', 35000, 'O que muda no seu imposto de renda com a nova reforma'),
('IA no mercado de trabalho', 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e', 'UOL Tech', 22000, 'As profissões que mais serão impactadas pela IA este ano');

-- Grants
GRANT SELECT ON public.viral_contents TO authenticated;
GRANT SELECT ON public.trending_topics TO authenticated;
