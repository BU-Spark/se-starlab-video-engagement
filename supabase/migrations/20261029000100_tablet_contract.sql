-- Align the shared schema with the tablet contract (app/types/study.types.ts).
-- Safe to re-run: every change is guarded with IF [NOT] EXISTS.

-- 0. One-time data fix, run only on the first application of this migration (before the new columns exist).
--    The earlier researcher build stored randomization differently from the tablet's rule in
--    app/utils/runner/orderBlocks.ts (randomized = true shuffles every block; groups apply only when false):
--      "Off"        randomized = false, leftover group names possible
--      "All blocks" randomized = true,  every block in group 'all'
--      "By group"   randomized = true,  researcher groups
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'studies' and column_name = 'comment_button'
  ) then
    -- "Off": groups were ignored, so drop them.
    update public.blocks b set random_group = null
    from public.studies s where b.study_id = s.id and not s.randomized;
    -- "All blocks": keep randomized, drop the placeholder group.
    update public.blocks b set random_group = null
    from public.studies s
    where b.study_id = s.id and s.randomized
      and not exists (
        select 1 from public.blocks o where o.study_id = s.id and o.random_group is distinct from 'all'
      );
    -- "By group": the tablet applies groups only when randomized is false.
    update public.studies s set randomized = false
    where s.randomized and exists (select 1 from public.blocks b where b.study_id = s.id and b.random_group is not null);
  end if;
end $$;

-- 1. Study settings the tablet reads (StudyControlSettings / StudyDisplaySettings).
alter table public.studies
  add column if not exists comment_button boolean not null default false,
  add column if not exists save_button    boolean not null default false,
  add column if not exists share_button   boolean not null default false,
  add column if not exists pause_on_share boolean not null default false,
  add column if not exists share_options  text[],            -- null = tablet default list
  add column if not exists audio_record   boolean not null default false,
  add column if not exists camera_record  boolean not null default false;

-- 2. Video captions and researcher-written comments (VideoBlock.title / description / comments).
alter table public.blocks
  add column if not exists title       text,
  add column if not exists description text,
  add column if not exists comments    jsonb;                 -- [{ "author": text, "text": text, "likes"?: int }]

alter table public.blocks drop constraint if exists blocks_comments_is_array;
alter table public.blocks add constraint blocks_comments_is_array
  check (comments is null or jsonb_typeof(comments) = 'array');

-- 3. Block type names follow the tablet: 'instructions' (was 'instruction').
update public.blocks set type = 'instructions' where type = 'instruction';
alter table public.blocks drop constraint if exists blocks_type_check;
alter table public.blocks add constraint blocks_type_check check (type in ('instructions', 'video', 'survey'));

-- 4. Per-view measures the tablet records (BlockResult).
alter table public.block_views
  add column if not exists share_time_ms   int4,
  add column if not exists share_choice    text,
  add column if not exists comment_time_ms int4,
  add column if not exists save_time_ms    int4,
  add column if not exists saved           boolean not null default false;

-- 5. Upload one finished session atomically.
--    The tablet derives run.id from (study, participant, start time), so a retried upload of the
--    same session hits ON CONFLICT and is ignored instead of creating a duplicate run.
create or replace function public.submit_run(run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  run_id uuid := (run ->> 'id')::uuid;
begin
  insert into public.runs (id, study_id, participant_id, started_at, completed_at, synced_at)
  values (
    run_id,
    (run ->> 'study_id')::uuid,
    run ->> 'participant_id',
    (run ->> 'started_at')::timestamptz,
    (run ->> 'completed_at')::timestamptz,
    now()
  )
  on conflict (id) do nothing;

  if not found then
    return run_id; -- already stored by an earlier attempt
  end if;

  insert into public.block_views (
    run_id, block_id, view_order, stimulus, started_at, watch_time_ms,
    button_press, button_time_ms, swiped_back,
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
