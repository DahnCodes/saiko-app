create table if not exists public.user_character_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id integer not null,
  source_anime_id uuid not null references public.anime(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, character_id)
);

create index if not exists user_character_favorites_user_idx
  on public.user_character_favorites (user_id);

alter table public.user_character_favorites enable row level security;
drop policy if exists "Users can read own character favorites" on public.user_character_favorites;
create policy "Users can read own character favorites"
  on public.user_character_favorites for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Users can add own character favorites" on public.user_character_favorites;
create policy "Users can add own character favorites"
  on public.user_character_favorites for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Users can remove own character favorites" on public.user_character_favorites;
create policy "Users can remove own character favorites"
  on public.user_character_favorites for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, delete on public.user_character_favorites to authenticated;

-- Onboarding counts only the three starter titles. Additional favorites are
-- deliberately retained in the same source table and do not block completion.
create or replace function public.get_my_onboarding_state()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object('id', p.id, 'username', p.username,
      'avatar_url', p.avatar_url, 'onboarding_completed', p.onboarding_completed)
      from public.profiles p where p.id = auth.uid()),
    'favorite_count', (select count(*) from public.user_favorite_anime f
      join public.anime a on a.id = f.anime_id
      where f.user_id = auth.uid()
        and a.anilist_id in (20, 21, 269, 16498, 21459, 101922))
  );
$$;
grant execute on function public.get_my_onboarding_state() to authenticated;

create or replace function public.save_my_favorites(anime_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if cardinality(anime_ids) is distinct from 3 or
     (select count(*) from public.anime where id = any(anime_ids)
       and anilist_id in (20, 21, 269, 16498, 21459, 101922)) <> 3 then
    raise exception 'Choose exactly three distinct starter anime';
  end if;
  delete from public.user_favorite_anime f using public.anime a
    where f.anime_id = a.id and f.user_id = auth.uid()
      and a.anilist_id in (20, 21, 269, 16498, 21459, 101922);
  insert into public.user_favorite_anime (user_id, anime_id)
    select auth.uid(), unnest(anime_ids)
    on conflict (user_id, anime_id) do nothing;
end;
$$;
revoke execute on function public.save_my_favorites(uuid[]) from public, anon;
grant execute on function public.save_my_favorites(uuid[]) to authenticated;
