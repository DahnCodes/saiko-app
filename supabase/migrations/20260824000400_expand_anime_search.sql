alter table public.anime add column if not exists format text;
alter table public.anime add column if not exists genres text[] not null default '{}';
alter table public.anime add column if not exists synonyms text[] not null default '{}';

create index if not exists anime_format_idx on public.anime (format);
create or replace function public.search_anime_local(query_text text, result_limit integer default 24)
returns setof public.anime
language sql stable security invoker set search_path = ''
as $$
  with input as (select lower(regexp_replace(trim(query_text), '\s+', ' ', 'g')) as query),
  ranked as (
    select anime as record, anime.popularity,
      greatest(
        case when lower(anime.title) = input.query then 100 when lower(anime.title) like input.query || '%' then 70 when lower(anime.title) like '%' || input.query || '%' then 50 else 0 end,
        case when lower(coalesce(anime.title_english, '')) = input.query then 100 when lower(coalesce(anime.title_english, '')) like input.query || '%' then 70 when lower(coalesce(anime.title_english, '')) like '%' || input.query || '%' then 50 else 0 end,
        case when lower(coalesce(anime.title_romaji, '')) = input.query then 100 when lower(coalesce(anime.title_romaji, '')) like input.query || '%' then 70 when lower(coalesce(anime.title_romaji, '')) like '%' || input.query || '%' then 50 else 0 end,
        case when lower(coalesce(anime.title_native, '')) = input.query then 100 when lower(coalesce(anime.title_native, '')) like input.query || '%' then 70 when lower(coalesce(anime.title_native, '')) like '%' || input.query || '%' then 50 else 0 end,
        coalesce((select max(case when lower(synonym) = input.query then 90 when lower(synonym) like input.query || '%' then 65 when lower(synonym) like '%' || input.query || '%' then 45 else 0 end) from unnest(anime.synonyms) synonym), 0)
      ) as relevance
    from public.anime anime cross join input
  )
  select (record).* from ranked where relevance > 0 order by relevance desc, popularity desc nulls last limit least(greatest(result_limit, 1), 50);
$$;

grant execute on function public.search_anime_local(text, integer) to anon, authenticated, service_role;
