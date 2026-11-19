-- Fills in what the tablet did not record yet:
--   * block_views.video_start_at / video_end_at   (T3: absolute video timestamps, ms precision)
--   * block_views.pause_count / paused_ms          (participant tap-to-pause)
--   * runs.recording_path / recording_started_at   (studies.audio_record / camera_record)
-- and brings export_rows up to date with every block_views column.

-- ---------------------------------------------------------------------------------------------
-- Pauses: only the participant's own taps count, not the pause while a share/comment panel is open.
alter table public.block_views
  add column if not exists pause_count int4 not null default 0 check (pause_count >= 0),
  add column if not exists paused_ms   int4 not null default 0 check (paused_ms >= 0);

-- Recording: one file per run (audio, camera, or both in one file), in the private run-recordings bucket.
-- recording_started_at lines the recording up with block_views.started_at / video_start_at.
alter table public.runs
  add column if not exists recording_path       text,
  add column if not exists recording_started_at timestamptz;

alter table public.runs drop constraint if exists runs_recording_complete;
alter table public.runs add constraint runs_recording_complete
  check ((recording_path is null) = (recording_started_at is null));

-- ---------------------------------------------------------------------------------------------
-- Private bucket for participant recordings. The tablet (anon) may only add files: it cannot
-- list, download, overwrite or delete them. Researchers read them through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('run-recordings', 'run-recordings', false, 52428800, array['audio/*', 'video/*'])
on conflict (id) do nothing;

drop policy if exists "tablet uploads recordings" on storage.objects;
create policy "tablet uploads recordings" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'run-recordings');
drop policy if exists "researchers read recordings" on storage.objects;
create policy "researchers read recordings" on storage.objects for select to authenticated
  using (bucket_id = 'run-recordings');
drop policy if exists "researchers delete recordings" on storage.objects;
create policy "researchers delete recordings" on storage.objects for delete to authenticated
  using (bucket_id = 'run-recordings');

-- ---------------------------------------------------------------------------------------------
-- submit_run now also stores the video timestamps, pauses and the recording reference.
create or replace function public.submit_run(run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid := (run ->> 'id')::uuid;
begin
  insert into public.runs (
    id, study_id, participant_id, started_at, completed_at, synced_at, recording_path, recording_started_at
  )
  values (
    run_id,
    (run ->> 'study_id')::uuid,
    run ->> 'participant_id',
    (run ->> 'started_at')::timestamptz,
    (run ->> 'completed_at')::timestamptz,
    now(),
    run ->> 'recording_path',
    (run ->> 'recording_started_at')::timestamptz
  )
  on conflict (id) do nothing;

  if not found then
    return run_id; -- already stored by an earlier attempt
  end if;

  insert into public.block_views (
    run_id, block_id, view_order, stimulus, started_at, watch_time_ms,
    button_press, button_time_ms, swiped_back,
    video_start_at, video_end_at, pause_count, paused_ms,
    share_time_ms, share_choice, comment_time_ms, save_time_ms, saved
  )
  select
    run_id,
    (v ->> 'block_id')::uuid,
    (v ->> 'view_order')::int,
    v ->> 'stimulus',
    (v ->> 'started_at')::timestamptz,
    (v ->> 'watch_time_ms')::int,
    v ->> 'button_press',
    (v ->> 'button_time_ms')::int,
    coalesce((v ->> 'swiped_back')::boolean, false),
    (v ->> 'video_start_at')::timestamptz,
    (v ->> 'video_end_at')::timestamptz,
    coalesce((v ->> 'pause_count')::int, 0),
    coalesce((v ->> 'paused_ms')::int, 0),
    (v ->> 'share_time_ms')::int,
    v ->> 'share_choice',
    (v ->> 'comment_time_ms')::int,
    (v ->> 'save_time_ms')::int,
    coalesce((v ->> 'saved')::boolean, false)
  from jsonb_array_elements(run -> 'views') as v;

  return run_id;
end;
$$;

revoke all on function public.submit_run(jsonb) from public;
grant execute on function public.submit_run(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- export_rows: the data-spec columns first, then the side-button, pause and recording columns.
-- Same 0-for-empty convention as the original columns.
drop view if exists public.export_rows;
create view public.export_rows
with (security_invoker = true) as
select
  s.name as "Study_ID",
  r.participant_id as "Participant_ID",
  b.label as "Block",
  v.view_order as "Order",
  v.stimulus as "Stimuli",
  v.watch_time_ms as "Watch_time",
  v.swiped_back::int as "Swipe_back",
  coalesce(v.button_press, '0') as "Button_press",
  coalesce(v.button_time_ms, 0) as "Button_time",
  v.video_start_at as "Video_start_timestamp",
  v.video_end_at as "Video_end_timestamp",
  v.pause_count as "Pause_count",
  v.paused_ms as "Paused_time",
  coalesce(v.share_time_ms, 0) as "Share_time",
  coalesce(v.share_choice, '0') as "Share_choice",
  coalesce(v.comment_time_ms, 0) as "Comment_time",
  coalesce(v.save_time_ms, 0) as "Save_time",
  v.saved::int as "Saved",
  r.recording_path as "Recording",
  r.recording_started_at as "Recording_start_timestamp",
  r.id as run_id,
  s.id as study_id
from public.block_views v
join public.runs r on r.id = v.run_id
join public.studies s on s.id = r.study_id
join public.blocks b on b.id = v.block_id;
