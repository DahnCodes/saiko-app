create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists anime_set_updated_at on public.anime;
create trigger anime_set_updated_at before update on public.anime for each row execute function public.set_updated_at();

create index if not exists anime_mal_id_idx on public.anime (mal_id) where mal_id is not null;
create index if not exists anime_status_popularity_idx on public.anime (status, popularity desc nulls last);
create index if not exists anime_titles_search_idx on public.anime using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(title_english, '') || ' ' || coalesce(title_romaji, '') || ' ' || coalesce(title_native, '')));

revoke insert, update, delete on public.anime from anon, authenticated;
grant select on public.anime to anon, authenticated;
