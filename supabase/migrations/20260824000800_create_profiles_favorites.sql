create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$')
);
create unique index if not exists profiles_username_unique on public.profiles (lower(username));
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke delete on public.profiles from authenticated;

create table if not exists public.user_favorite_anime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references public.anime(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, anime_id)
);
create index if not exists user_favorites_user_idx on public.user_favorite_anime (user_id);
alter table public.user_favorite_anime enable row level security;
 drop policy if exists "Users can read own favorites" on public.user_favorite_anime;
 create policy "Users can read own favorites" on public.user_favorite_anime for select to authenticated using (user_id = auth.uid());
 drop policy if exists "Users can add own favorites" on public.user_favorite_anime;
 create policy "Users can add own favorites" on public.user_favorite_anime for insert to authenticated with check (user_id = auth.uid());
 drop policy if exists "Users can remove own favorites" on public.user_favorite_anime;
 create policy "Users can remove own favorites" on public.user_favorite_anime for delete to authenticated using (user_id = auth.uid());
