create table if not exists public.public_anime_dna (username text primary key, archetype_name text not null, archetype_icon text not null, description text not null, traits jsonb not null, favorite_titles text[] not null default '{}', updated_at timestamptz not null default now());
alter table public.public_anime_dna enable row level security;
create policy "Public DNA is readable" on public.public_anime_dna for select to anon, authenticated using (true);
