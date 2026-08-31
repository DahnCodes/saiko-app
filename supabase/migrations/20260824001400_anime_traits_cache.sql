-- Cache table for SAIKO anime trait profiles.
-- Avoids repeated trait extraction on every recommendation request.
create table if not exists public.anime_traits (
  id uuid primary key default gen_random_uuid(),
  anilist_id integer not null unique,
  mal_id integer unique,
  trait_profiles jsonb not null default '[]',
  -- trait_profiles shape: Array<{ trait: string; strength: number; source: "genre"|"theme"|"synopsis"; evidence?: string }>
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists anime_traits_anilist_id_idx on public.anime_traits (anilist_id);
create index if not exists anime_traits_mal_id_idx on public.anime_traits (mal_id) where mal_id is not null;

alter table public.anime_traits enable row level security;

-- Public read access
drop policy if exists "Anime traits are publicly readable" on public.anime_traits;
create policy "Anime traits are publicly readable" on public.anime_traits
  for select to anon, authenticated using (true);

-- INSERT policy (only WITH CHECK, no USING)
drop policy if exists "Service can insert anime traits" on public.anime_traits;
create policy "Service can insert anime traits" on public.anime_traits
  for insert to authenticated with check (true);

-- UPDATE policy (USING + WITH CHECK)
drop policy if exists "Service can update anime traits" on public.anime_traits;
create policy "Service can update anime traits" on public.anime_traits
  for update to authenticated using (true) with check (true);

-- Auto-update updated_at
drop trigger if exists anime_traits_set_updated_at on public.anime_traits;
create trigger anime_traits_set_updated_at before update on public.anime_traits
  for each row execute function public.set_updated_at();

comment on table public.anime_traits is
  'Cached SAIKO trait profiles for anime. Prevents repeated trait extraction on every recommendation request.';
comment on column public.anime_traits.trait_profiles is
  'Array of {trait, strength, source, evidence}. strength is 0-1. source is genre|theme|synopsis. evidence is optional excerpt.';
