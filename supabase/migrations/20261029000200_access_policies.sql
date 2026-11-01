-- Row-level security for the two front ends. Review with the team before applying.
--
-- Roles:
--   anon           the tablet app (no login; publishable key)
--   authenticated  researchers once they sign in with Supabase Auth
--
-- The tablet only needs to READ studies, blocks and their media, and to WRITE runs through
-- public.submit_run (security definer), so it gets no direct insert/update/delete rights.

alter table public.studies     enable row level security;
alter table public.blocks      enable row level security;
alter table public.runs        enable row level security;
alter table public.block_views enable row level security;

-- Tablet + researchers read study definitions.
drop policy if exists "read studies" on public.studies;
create policy "read studies" on public.studies for select to anon, authenticated using (true);
drop policy if exists "read blocks" on public.blocks;
create policy "read blocks" on public.blocks for select to anon, authenticated using (true);

-- Researchers manage study definitions.
drop policy if exists "researchers write studies" on public.studies;
create policy "researchers write studies" on public.studies for all to authenticated using (true) with check (true);
drop policy if exists "researchers write blocks" on public.blocks;
create policy "researchers write blocks" on public.blocks for all to authenticated using (true) with check (true);

-- Researchers read participant data (the tablet writes it only via submit_run).
drop policy if exists "researchers read runs" on public.runs;
create policy "researchers read runs" on public.runs for select to authenticated using (true);
drop policy if exists "researchers read block views" on public.block_views;
create policy "researchers read block views" on public.block_views for select to authenticated using (true);

-- Private media bucket: researchers upload/delete, tablet + researchers read (signed URLs).
insert into storage.buckets (id, name, public) values ('study-media', 'study-media', false)
  on conflict (id) do nothing;
drop policy if exists "read study media" on storage.objects;
create policy "read study media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'study-media');
drop policy if exists "researchers upload study media" on storage.objects;
create policy "researchers upload study media" on storage.objects for insert to authenticated
  with check (bucket_id = 'study-media');
drop policy if exists "researchers delete study media" on storage.objects;
create policy "researchers delete study media" on storage.objects for delete to authenticated
  using (bucket_id = 'study-media');

-- ---------------------------------------------------------------------------------------------
-- DEMO ONLY — the researcher website has no login yet, so it also uses the anon role.
-- Until Supabase Auth is added, run the block below on a development project to let the
-- researcher pages work. It gives anyone with the publishable key full control of studies.
--
-- create policy "demo anon write studies" on public.studies for all to anon using (true) with check (true);
-- create policy "demo anon write blocks"  on public.blocks  for all to anon using (true) with check (true);
-- create policy "demo anon read runs"     on public.runs        for select to anon using (true);
-- create policy "demo anon read views"    on public.block_views for select to anon using (true);
-- create policy "demo anon upload media"  on storage.objects for insert to anon with check (bucket_id = 'study-media');
-- create policy "demo anon delete media"  on storage.objects for delete to anon using (bucket_id = 'study-media');

-- ---------------------------------------------------------------------------------------------
-- Studies are locked once a participant has run them: block_views refer to their blocks, so
-- changing blocks afterwards would change what collected data means. The researcher UI enforces
-- this too; the trigger makes it hold for every client.
create or replace function public.block_edits_after_runs() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.runs where study_id = coalesce(new.study_id, old.study_id)) then
    raise exception 'This study has participant runs and can no longer be changed.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists blocks_locked_after_runs on public.blocks;
create trigger blocks_locked_after_runs before insert or update or delete on public.blocks
  for each row execute function public.block_edits_after_runs();
