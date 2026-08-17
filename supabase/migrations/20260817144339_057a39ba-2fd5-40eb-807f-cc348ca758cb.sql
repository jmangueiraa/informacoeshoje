-- Limpar duplicatas existentes antes de aplicar a restrição
DELETE FROM public.viral_contents
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY subject ORDER BY created_at DESC) as row_num
        FROM public.viral_contents
    ) t
    WHERE t.row_num > 1
);

DELETE FROM public.trending_topics
WHERE id IN (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY subject ORDER BY trending_at DESC) as row_num
        FROM public.trending_topics
    ) t
    WHERE t.row_num > 1
);

-- Adicionar restrição de unicidade na coluna subject
ALTER TABLE public.viral_contents ADD CONSTRAINT viral_contents_subject_key UNIQUE (subject);
ALTER TABLE public.trending_topics ADD CONSTRAINT trending_topics_subject_key UNIQUE (subject);
