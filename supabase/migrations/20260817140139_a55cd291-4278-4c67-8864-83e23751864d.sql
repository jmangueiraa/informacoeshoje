CREATE TABLE public.viral_contents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  image_url text,
  video_url text,
  type text NOT NULL CHECK (type IN ('image', 'video')),
  category text NOT NULL DEFAULT 'trending',
  source text,
  score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  mentions integer DEFAULT 0,
  suggested_title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viral_contents TO authenticated;
GRANT ALL ON public.viral_contents TO service_role;

ALTER TABLE public.viral_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to read viral contents"
  ON public.viral_contents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage viral contents"
  ON public.viral_contents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_viral_contents_updated_at
    BEFORE UPDATE ON public.viral_contents
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();