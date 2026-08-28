create table if not exists public.user_recommendations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recommendations jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_recommendations enable row level security;
drop policy if exists "Users can read own recommendations" on public.user_recommendations;
create policy "Users can read own recommendations" on public.user_recommendations for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can upsert own recommendations" on public.user_recommendations;
create policy "Users can upsert own recommendations" on public.user_recommendations for insert, update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.user_recommendations to anon, authenticated;
