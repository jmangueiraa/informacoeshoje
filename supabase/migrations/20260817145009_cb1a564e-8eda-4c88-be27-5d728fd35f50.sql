-- Adicionando a coluna source_url às tabelas virais e tendências
ALTER TABLE public.viral_contents ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.trending_topics ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Atualizando as tabelas com links de exemplo reais para os dados existentes
UPDATE public.viral_contents 
SET source_url = CASE 
    WHEN source ILIKE '%UOL%' THEN 'https://noticias.uol.com.br/'
    WHEN source ILIKE '%Globo%' THEN 'https://oglobo.globo.com/'
    WHEN source ILIKE '%G1%' THEN 'https://g1.globo.com/'
    WHEN source ILIKE '%TikTok%' THEN 'https://www.tiktok.com/'
    ELSE 'https://www.google.com/search?q=' || encode(subject::bytea, 'escape')
END
WHERE source_url IS NULL;

UPDATE public.trending_topics 
SET source_url = CASE 
    WHEN source ILIKE '%UOL%' THEN 'https://noticias.uol.com.br/'
    WHEN source ILIKE '%Globo%' THEN 'https://oglobo.globo.com/'
    WHEN source ILIKE '%G1%' THEN 'https://g1.globo.com/'
    ELSE 'https://www.google.com/search?q=' || encode(subject::bytea, 'escape')
END
WHERE source_url IS NULL;
