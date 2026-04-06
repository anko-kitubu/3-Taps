create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  if tg_op = 'INSERT' and new.created_at is null then
    new.created_at = new.updated_at;
  end if;
  return new;
end;
$$;

create table if not exists public.subjects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  name text not null check (char_length(trim(name)) > 0),
  emoji text not null check (char_length(trim(emoji)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id text not null,
  subject_id text not null references public.subjects (id),
  date date not null,
  type text not null check (type in ('課題', '試験', '補講')),
  memo text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists subjects_user_updated_idx on public.subjects (user_id, updated_at desc);
create index if not exists tasks_user_updated_idx on public.tasks (user_id, updated_at desc);
create index if not exists tasks_user_date_idx on public.tasks (user_id, date);

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
before insert or update on public.subjects
for each row
execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before insert or update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.subjects enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "subjects_select_own" on public.subjects;
create policy "subjects_select_own"
on public.subjects
for select
using (auth.uid() = user_id);

drop policy if exists "subjects_insert_own" on public.subjects;
create policy "subjects_insert_own"
on public.subjects
for insert
with check (auth.uid() = user_id);

drop policy if exists "subjects_update_own" on public.subjects;
create policy "subjects_update_own"
on public.subjects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks
for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks
for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    join pg_class cls on cls.oid = rel.prrelid
    where pub.pubname = 'supabase_realtime'
      and cls.relname = 'subjects'
  ) then
    execute 'alter publication supabase_realtime add table public.subjects';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel rel
    join pg_publication pub on pub.oid = rel.prpubid
    join pg_class cls on cls.oid = rel.prrelid
    where pub.pubname = 'supabase_realtime'
      and cls.relname = 'tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.tasks';
  end if;
end;
$$;
