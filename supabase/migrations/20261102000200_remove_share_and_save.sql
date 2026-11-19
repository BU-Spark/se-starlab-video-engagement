-- Share and save are removed from the study: the tablet no longer shows Share or Save buttons,
-- so their settings and recorded columns are dropped.

-- The view and submit_run read the dropped columns, so they are replaced first.
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
  r.recording_path as "Recording",
  r.recording_started_at as "Recording_start_timestamp",
  r.id as run_id,
  s.id as study_id
from public.block_views v
join public.runs r on r.id = v.run_id
join public.studies s on s.id = r.study_id
join public.blocks b on b.id = v.block_id;

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
    video_start_at, video_end_at, pause_count, paused_ms
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
    coalesce((v ->> 'paused_ms')::int, 0)
  from jsonb_array_elements(run -> 'views') as v;

  return run_id;
end;
$$;

revoke all on function public.submit_run(jsonb) from public;
grant execute on function public.submit_run(jsonb) to anon, authenticated;

alter table public.block_views
  drop column if exists share_time_ms,
  drop column if exists share_choice,
  drop column if exists save_time_ms,
  drop column if exists saved;

alter table public.studies
  drop column if exists save_button,
  drop column if exists share_button,
  drop column if exists pause_on_share,
  drop column if exists share_options;
