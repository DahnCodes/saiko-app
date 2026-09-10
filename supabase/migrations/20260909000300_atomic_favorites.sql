-- Replace Core 3 in one transaction so a failed save cannot erase old favorites.
create or replace function public.save_my_favorites(anime_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'Create a profile first'; end if;
  if cardinality(anime_ids) is distinct from 3 or
     (select count(*) from public.anime where id = any(anime_ids)
       and anilist_id in (20, 21, 269, 101922, 16498, 21459)) <> 3 then
    raise exception 'Choose exactly three distinct starter anime';
  end if;
  delete from public.user_favorite_anime where user_id = auth.uid();
  insert into public.user_favorite_anime (user_id, anime_id)
    select auth.uid(), unnest(anime_ids);
end;
$$;
revoke execute on function public.save_my_favorites(uuid[]) from public, anon;
grant execute on function public.save_my_favorites(uuid[]) to authenticated;
