grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.user_favorite_anime to authenticated;

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
create unique index if not exists profiles_username_unique on public.profiles (lower(username)) where username is not null;

create or replace function public.get_my_onboarding_state()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'onboarding_completed', p.onboarding_completed
      )
      from public.profiles p
      where p.id = auth.uid()
    ),
    'favorite_count', (
      select count(*)
      from public.user_favorite_anime f
      where f.user_id = auth.uid()
    )
  );
$$;

grant execute on function public.get_my_onboarding_state() to authenticated;
