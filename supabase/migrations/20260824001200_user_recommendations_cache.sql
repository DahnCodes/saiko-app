create table if not exists public.user_recommendations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recommendations jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_recommendations enable row level security;

drop policy if exists "Users can read own recommendations" on public.user_recommendations;
create policy "Users can read own recommendations" on public.user_recommendations
  for select to authenticated using (user_id = auth.uid());

-- Split upsert into separate insert + update policies:
-- Postgres requires WITH CHECK (not USING) for INSERT
drop policy if exists "Users can insert own recommendations" on public.user_recommendations;
create policy "Users can insert own recommendations" on public.user_recommendations
  for insert to authenticated with check (user_id = auth.uid());

-- UPDATE needs both USING (row-level filter) and WITH CHECK (new row validation)
drop policy if exists "Users can update own recommendations" on public.user_recommendations;
create policy "Users can update own recommendations" on public.user_recommendations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.user_recommendations to anon, authenticated;
