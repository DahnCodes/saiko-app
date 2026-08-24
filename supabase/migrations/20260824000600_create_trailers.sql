create table if not exists public.trailers (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.anime(id) on delete cascade,
  youtube_video_id text not null unique,
  title text not null,
  description text,
  thumbnail text,
  channel_name text,
  published_at timestamptz,
  duration text,
  youtube_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trailers_anime_id_idx on public.trailers (anime_id);
create index if not exists trailers_created_at_idx on public.trailers (created_at desc);

drop trigger if exists trailers_set_updated_at on public.trailers;
create trigger trailers_set_updated_at before update on public.trailers for each row execute function public.set_updated_at();

alter table public.trailers enable row level security;
drop policy if exists "Trailers are publicly readable" on public.trailers;
create policy "Trailers are publicly readable" on public.trailers for select to anon, authenticated using (true);
revoke insert, update, delete on public.trailers from anon, authenticated;
grant select on public.trailers to anon, authenticated;
