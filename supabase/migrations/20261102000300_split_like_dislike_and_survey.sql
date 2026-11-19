-- Splits block_views.button_press into two clearly named responses:
--   like_dislike  / like_dislike_time_ms   video blocks: 'Like' (was 'Right') or 'Dislike' (was 'Left')
--   survey_answer / survey_time_ms         survey blocks: the option the participant picked
-- Existing rows are converted, then button_press / button_time_ms are dropped.

alter table public.block_views
  add column if not exists like_dislike         text check (like_dislike in ('Like', 'Dislike')),
  add column if not exists like_dislike_time_ms int4 check (like_dislike_time_ms >= 0),
  add column if not exists survey_answer        text,
  add column if not exists survey_time_ms       int4 check (survey_time_ms >= 0);

update public.block_views v
set like_dislike = case v.button_press when 'Right' then 'Like' when 'Left' then 'Dislike' end,
    like_dislike_time_ms = v.button_time_ms
from public.blocks b
where b.id = v.block_id and b.type = 'video' and v.button_press in ('Right', 'Left');

update public.block_views v
set survey_answer = v.button_press,
    survey_time_ms = v.button_time_ms
from public.blocks b
where b.id = v.block_id and b.type = 'survey' and v.button_press is not null;

-- An answer always has a time, and a time always has an answer.
alter table public.block_views drop constraint if exists block_views_like_dislike_complete;
alter table public.block_views add constraint block_views_like_dislike_complete
  check ((like_dislike is null) = (like_dislike_time_ms is null));
alter table public.block_views drop constraint if exists block_views_survey_answer_complete;
alter table public.block_views add constraint block_views_survey_answer_complete
  check ((survey_answer is null) = (survey_time_ms is null));

-- The view and submit_run read button_press, so they are replaced before it is dropped.
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
  coalesce(v.like_dislike, '0') as "Like_dislike",
  coalesce(v.like_dislike_time_ms, 0) as "Like_dislike_time",
  coalesce(v.survey_answer, '0') as "Survey_answer",
  coalesce(v.survey_time_ms, 0) as "Survey_time",
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
    like_dislike, like_dislike_time_ms, survey_answer, survey_time_ms, swiped_back,
    video_start_at, video_end_at, pause_count, paused_ms
  )
  select
    run_id,
    (v ->> 'block_id')::uuid,
    (v ->> 'view_order')::int,
    v ->> 'stimulus',
    (v ->> 'started_at')::timestamptz,
    (v ->> 'watch_time_ms')::int,
    v ->> 'like_dislike',
    (v ->> 'like_dislike_time_ms')::int,
    v ->> 'survey_answer',
    (v ->> 'survey_time_ms')::int,
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
  drop column if exists button_press,
  drop column if exists button_time_ms;
