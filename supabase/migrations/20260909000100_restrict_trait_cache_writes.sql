-- Shared recommendation metadata must not be editable by arbitrary accounts.
-- Browsers retain extracted traits in memory; trusted service-role jobs may cache them.
drop policy if exists "Service can insert anime traits" on public.anime_traits;
drop policy if exists "Service can update anime traits" on public.anime_traits;
revoke insert, update, delete on public.anime_traits from anon, authenticated;
