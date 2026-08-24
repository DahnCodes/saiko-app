alter table public.anime add column if not exists is_hidden_gem boolean not null default false;
create index if not exists anime_hidden_gems_idx on public.anime (average_score desc nulls last, popularity asc nulls last) where is_hidden_gem = true;

update public.anime set source = 'anilist', is_hidden_gem = true where source = 'anilist_hidden_gem';
