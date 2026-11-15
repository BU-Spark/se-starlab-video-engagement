-- Researcher login: only accounts on the researchers allow-list may manage studies or read
-- participant data. Before this, every policy granted those rights to `authenticated`, which is
-- any account at all, including one a stranger signs up for.
--
-- Adding a researcher (Supabase dashboard):
--   1. Authentication → Users → Invite user (or Add user) with their email.
--   2. SQL editor: insert into public.researchers (user_id, email)
--        select id, email from auth.users where email = 'name@bu.edu';
-- Also turn off "Allow new users to sign up" under Authentication → Sign In / Providers.
--
-- The tablet (anon) is unchanged: it reads studies, blocks and media, writes runs only through
-- submit_run, and may only add recording files.

create table if not exists public.researchers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.researchers enable row level security;

-- A researcher can see their own row (the website uses it to check access after sign-in).
-- Nobody can change the list through the API; only the dashboard / SQL editor can.
drop policy if exists "researchers read own row" on public.researchers;
create policy "researchers read own row" on public.researchers for select to authenticated
  using (user_id = auth.uid());

-- security definer so policies can call it without the caller needing read access to the list.
create or replace function public.is_researcher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.researchers where user_id = auth.uid());
$$;

revoke all on function public.is_researcher() from public;
grant execute on function public.is_researcher() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Study definitions: everyone (tablet included) may read; only researchers may change them.
drop policy if exists "researchers write studies" on public.studies;
create policy "researchers write studies" on public.studies for all to authenticated
  using (public.is_researcher()) with check (public.is_researcher());
drop policy if exists "researchers write blocks" on public.blocks;
create policy "researchers write blocks" on public.blocks for all to authenticated
  using (public.is_researcher()) with check (public.is_researcher());

-- Participant data: researchers only.
drop policy if exists "researchers read runs" on public.runs;
create policy "researchers read runs" on public.runs for select to authenticated
  using (public.is_researcher());
drop policy if exists "researchers read block views" on public.block_views;
create policy "researchers read block views" on public.block_views for select to authenticated
  using (public.is_researcher());

-- Study media: researchers upload and delete.
drop policy if exists "researchers upload study media" on storage.objects;
create policy "researchers upload study media" on storage.objects for insert to authenticated
  with check (bucket_id = 'study-media' and public.is_researcher());
drop policy if exists "researchers delete study media" on storage.objects;
create policy "researchers delete study media" on storage.objects for delete to authenticated
  using (bucket_id = 'study-media' and public.is_researcher());

-- Recordings: the tablet may still add files; only researchers read or delete them.
drop policy if exists "researchers read recordings" on storage.objects;
create policy "researchers read recordings" on storage.objects for select to authenticated
  using (bucket_id = 'run-recordings' and public.is_researcher());
drop policy if exists "researchers delete recordings" on storage.objects;
create policy "researchers delete recordings" on storage.objects for delete to authenticated
  using (bucket_id = 'run-recordings' and public.is_researcher());

-- ---------------------------------------------------------------------------------------------
-- delete_study is security definer, so RLS does not apply inside it: check the caller here.
create or replace function public.delete_study(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_researcher() then
    raise exception 'Only researchers can delete studies.' using errcode = '42501';
  end if;
  delete from public.runs where study_id = target;
  delete from public.blocks where study_id = target;
  delete from public.studies where id = target;
end;
$$;

revoke all on function public.delete_study(uuid) from public;
grant execute on function public.delete_study(uuid) to authenticated;
