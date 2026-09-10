create table if not exists public.user_anime_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_id uuid not null references public.anime(id) on delete cascade,
  feedback_type text not null default 'not_for_me' check (feedback_type = 'not_for_me'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, anime_id, feedback_type)
);
create index if not exists user_anime_feedback_user_idx on public.user_anime_feedback (user_id);
alter table public.user_anime_feedback enable row level security;
drop policy if exists "Users can read own anime feedback" on public.user_anime_feedback;
create policy "Users can read own anime feedback" on public.user_anime_feedback for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can create own anime feedback" on public.user_anime_feedback;
create policy "Users can create own anime feedback" on public.user_anime_feedback for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users can remove own anime feedback" on public.user_anime_feedback;
create policy "Users can remove own anime feedback" on public.user_anime_feedback for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.user_anime_feedback to authenticated;
