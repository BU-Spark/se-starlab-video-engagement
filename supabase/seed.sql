-- LOCAL DEVELOPMENT ONLY.
--
-- The Supabase CLI runs this file after the migrations on `npx supabase start` / `npx supabase db reset`.
-- `npx supabase db push` never sends it to the cloud project.
--
-- The researcher pages have no login yet, so they use the anon (publishable) key like the tablet.
-- These are the demo-only policies from 20261029000200_access_policies.sql: they give anyone with the
-- publishable key full control of studies and read access to participant data. Never apply them to
-- the cloud project; replace them with researcher login (Supabase Auth) instead.

drop policy if exists "demo anon write studies" on public.studies;
create policy "demo anon write studies" on public.studies for all to anon using (true) with check (true);

drop policy if exists "demo anon write blocks" on public.blocks;
create policy "demo anon write blocks" on public.blocks for all to anon using (true) with check (true);

drop policy if exists "demo anon read runs" on public.runs;
create policy "demo anon read runs" on public.runs for select to anon using (true);

drop policy if exists "demo anon read views" on public.block_views;
create policy "demo anon read views" on public.block_views for select to anon using (true);

drop policy if exists "demo anon upload media" on storage.objects;
create policy "demo anon upload media" on storage.objects for insert to anon with check (bucket_id = 'study-media');

drop policy if exists "demo anon delete media" on storage.objects;
create policy "demo anon delete media" on storage.objects for delete to anon using (bucket_id = 'study-media');
