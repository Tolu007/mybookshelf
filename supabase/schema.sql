-- Shelf database schema
-- Safe to run multiple times against the same Supabase project — every
-- statement is idempotent, so re-running this file after a schema update
-- (new column, new table, etc.) just applies what's missing.

create extension if not exists "pgcrypto";

-- One row per user: the Google refresh token used to call the Drive API
-- on their behalf. Never exposed to the browser — only read by server code.
create table if not exists public.user_google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  scope text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  author text,
  category_id uuid references public.categories (id) on delete set null,
  format text not null check (format in ('pdf', 'epub')),
  drive_file_id text not null,
  cover_url text,
  file_size_bytes bigint,
  added_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.books add column if not exists description text;
alter table public.books add column if not exists want_to_read boolean not null default false;
alter table public.books add column if not exists is_favorite boolean not null default false;

create index if not exists books_user_id_idx on public.books (user_id);
create index if not exists books_category_id_idx on public.books (category_id);

-- One row per book: where the reader resumed to. `location` holds a page
-- number (PDF) or an EPUB CFI string (epub.js) depending on `books.format`.
create table if not exists public.reading_progress (
  book_id uuid primary key references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  location text,
  percent numeric(5, 2) not null default 0,
  updated_at timestamptz not null default now()
);

-- One row per reading session, used to roll up daily/weekly/monthly time
-- and to derive the streak calendar. A session is only written once it ends,
-- so there is no "currently open" row to reconcile.
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0)
);

-- The reader's wall-clock day (YYYY-MM-DD) at session end, supplied by the
-- client. Used for streaks/heatmap/day bucketing instead of re-deriving a
-- day from the UTC timestamp, which would misclassify late-evening sessions.
alter table public.reading_sessions add column if not exists local_date date;
update public.reading_sessions
  set local_date = (started_at at time zone 'utc')::date
  where local_date is null;
alter table public.reading_sessions alter column local_date set not null;

create index if not exists reading_sessions_user_started_idx
  on public.reading_sessions (user_id, started_at);

create index if not exists reading_sessions_user_local_date_idx
  on public.reading_sessions (user_id, local_date);

-- Cached rollups so the dashboard doesn't recompute streaks from raw
-- sessions on every load. Recalculated server-side whenever a session ends.
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_read_date date,
  books_finished integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Seed a user_stats row automatically so app code never has to special-case
-- a missing row for brand-new accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Highlights (EPUB text selections), free-standing notes, and bookmarks —
-- one table since they share the same shape (a location + optional text).
create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  type text not null check (type in ('highlight', 'note', 'bookmark')),
  -- EPUB CFI string or PDF page number, depending on the book's format.
  location text not null,
  excerpt text,
  note text,
  created_at timestamptz not null default now()
);

-- PDF highlight geometry: an array of {x, y, width, height}, each value a
-- 0-1 fraction of the page's displayed width/height at capture time. Since
-- all dimensions scale uniformly with zoom, these fractions stay correct at
-- any zoom level without needing to store an absolute scale. Null for EPUB
-- highlights (epub.js re-renders those from the stored CFI instead) and for
-- notes/bookmarks.
alter table public.annotations add column if not exists rects jsonb;

create index if not exists annotations_user_book_idx on public.annotations (user_id, book_id);

-- Atomic increment so concurrent "mark as finished" calls can't race each
-- other into a lost update.
create or replace function public.increment_books_finished(target_user_id uuid)
returns void
language sql
security invoker
as $$
  update public.user_stats
  set books_finished = books_finished + 1,
      updated_at = now()
  where user_id = target_user_id;
$$;

-- Row Level Security: every table is scoped to its owning user.
alter table public.user_google_tokens enable row level security;
alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.user_stats enable row level security;
alter table public.annotations enable row level security;

drop policy if exists "own tokens" on public.user_google_tokens;
create policy "own tokens" on public.user_google_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own books" on public.books;
create policy "own books" on public.books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reading progress" on public.reading_progress;
create policy "own reading progress" on public.reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reading sessions" on public.reading_sessions;
create policy "own reading sessions" on public.reading_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own stats" on public.user_stats;
create policy "own stats" on public.user_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own annotations" on public.annotations;
create policy "own annotations" on public.annotations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
