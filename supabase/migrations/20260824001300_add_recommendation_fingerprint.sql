-- Add fingerprint column to user_recommendations for safe cached lookup
alter table if exists public.user_recommendations
  add column if not exists fingerprint text;

-- Grant usage to authenticated users is handled by existing policies; no extra grants needed.
