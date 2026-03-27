-- CACON Trading Journal - Supabase schema gần layout hiện tại
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.trading_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_trading_journals_updated_at on public.trading_journals;
create trigger trg_trading_journals_updated_at before update on public.trading_journals
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.trading_journals enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "journal_select_own" on public.trading_journals;
create policy "journal_select_own" on public.trading_journals
for select using (auth.uid() = user_id);

drop policy if exists "journal_insert_own" on public.trading_journals;
create policy "journal_insert_own" on public.trading_journals
for insert with check (auth.uid() = user_id);

drop policy if exists "journal_update_own" on public.trading_journals;
create policy "journal_update_own" on public.trading_journals
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('cacon-files', 'cacon-files', true)
on conflict (id) do nothing;

drop policy if exists "storage_read_public_cacon" on storage.objects;
create policy "storage_read_public_cacon" on storage.objects
for select to public using (bucket_id = 'cacon-files');

drop policy if exists "storage_insert_own_cacon" on storage.objects;
create policy "storage_insert_own_cacon" on storage.objects
for insert to authenticated with check (
  bucket_id = 'cacon-files' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_update_own_cacon" on storage.objects;
create policy "storage_update_own_cacon" on storage.objects
for update to authenticated using (
  bucket_id = 'cacon-files' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'cacon-files' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_delete_own_cacon" on storage.objects;
create policy "storage_delete_own_cacon" on storage.objects
for delete to authenticated using (
  bucket_id = 'cacon-files' and (storage.foldername(name))[1] = auth.uid()::text
);
