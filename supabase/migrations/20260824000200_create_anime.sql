create table if not exists public.anime (
  id uuid primary key default gen_random_uuid(),
  anilist_id integer not null unique,
  mal_id integer unique,
  title text not null,
  title_native text,
  title_romaji text,
  title_english text,
  description text,
  cover_image text,
  banner_image text,
  episodes integer,
  duration integer,
  status text,
  season text,
  season_year integer,
  average_score numeric,
  popularity integer,
  start_date date,
  end_date date,
  source text not null default 'anilist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists anime_popularity_idx on public.anime (popularity desc nulls last);
create index if not exists anime_title_idx on public.anime using gin (to_tsvector('simple', title));
alter table public.anime enable row level security;
drop policy if exists "Anime is publicly readable" on public.anime;
create policy "Anime is publicly readable" on public.anime for select to anon, authenticated using (true);
