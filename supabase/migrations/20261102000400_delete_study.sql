-- Deleting a study now also deletes its participant data, so researchers can remove studies that
-- have runs. delete_study removes runs (block_views cascade), blocks and the study in one transaction;
-- the lock trigger allows the block deletes because the runs are gone first.
-- Storage files (videos, icons, recordings) are removed by the researcher website after this call.

create or replace function public.delete_study(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.runs where study_id = target;
  delete from public.blocks where study_id = target;
  delete from public.studies where id = target;
end;
$$;

revoke all on function public.delete_study(uuid) from public;
grant execute on function public.delete_study(uuid) to authenticated;

-- submit_run: a run for a study that no longer exists is ignored instead of failing forever.
create or replace function public.submit_run(run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid := (run ->> 'id')::uuid;
begin
  -- The researcher deleted this study while the run was waiting on the tablet: drop the run.
  if not exists (select 1 from public.studies where id = (run ->> 'study_id')::uuid) then
    return null;
  end if;

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

