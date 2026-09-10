-- Public DNA is already intended to be published during onboarding.
-- Restrict publication to the profile username owned by the authenticated caller.
create policy "Users can publish own DNA" on public.public_anime_dna
  for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and username = public_anime_dna.username));
create policy "Users can update own DNA" on public.public_anime_dna
  for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and username = public_anime_dna.username))
  with check (exists (select 1 from public.profiles where id = auth.uid() and username = public_anime_dna.username));
grant insert, update on public.public_anime_dna to authenticated;
