
create table public.trending_topics (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  image_url text,
  source text,
  mentions integer default 0,
  trending_at timestamptz default now(),
  suggested_title text,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.trending_topics to authenticated;
grant all on public.trending_topics to service_role;

alter table public.trending_topics enable row level security;

create policy "Allow all authenticated to read trends"
  on public.trending_topics for select
  to authenticated
  using (true);

create policy "Admins can manage trends"
  on public.trending_topics for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
