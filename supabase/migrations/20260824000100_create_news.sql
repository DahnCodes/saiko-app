create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  image_url text,
  source_name text not null,
  source_url text not null,
  published_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint news_source_url_unique unique (source_url)
);

create index if not exists news_published_at_idx on public.news (published_at desc);

alter table public.news enable row level security;

drop policy if exists "News is publicly readable" on public.news;
create policy "News is publicly readable" on public.news
  for select to anon, authenticated using (true);
