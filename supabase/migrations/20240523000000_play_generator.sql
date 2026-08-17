CREATE TABLE public.play_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    original_url TEXT NOT NULL,
    final_url TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.play_assets TO authenticated;
GRANT ALL ON public.play_assets TO service_role;

ALTER TABLE public.play_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own play assets"
    ON public.play_assets
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id);
