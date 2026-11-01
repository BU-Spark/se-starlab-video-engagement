-- Study schema: what researchers build (studies, blocks) and what participants produce (runs, block_views).
--
--   studies 1──* blocks
--   studies 1──* runs 1──* block_views *──1 blocks
--
-- Study and participant are attributes of a run, not rows mixed in with the blocks.
-- The flat CSV layout from the design document is the export_rows view at the bottom.

-- A study a researcher builds in the web app.
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  -- Shown as Study_ID in the export, so it must be unique.
  name text not null unique,
  -- Shuffle every block. When false, blocks sharing a random_group are still shuffled among themselves.
  randomized boolean not null default false,

  -- Display settings
  -- Show each video's progress bar at the top of the screen.
  show_video_bar boolean not null default true,
  -- Storage paths of uploaded button images. Null means the default icon
  -- (thumbs down on the left, thumbs up on the right).
  left_button_icon_path text,
  right_button_icon_path text,
  -- Text shown below each response button. Blank by default.
  left_button_text text not null default '',
  right_button_text text not null default '',

  -- Control options
  -- Swiping up returns to the previous block (and creates a new block_views row for the return viewing).
  allow_swipe_back boolean not null default true,
  -- Show the left/right response buttons over videos. When false they are hidden and inactive.
  show_response_buttons boolean not null default true,
  -- Tapping the screen pauses and resumes the video.
  allow_pausing boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One screen in a study. Columns that only apply to one block type are null for the others.
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  -- Position the researcher placed the block in (1-based). The order a participant sees is in block_views.
  position integer not null check (position > 0),
  type text not null check (type in ('instructions', 'video', 'survey')),
  -- Name used in the data output, e.g. "instruction1".
  label text not null,
  -- Blocks sharing a group are shuffled among the positions they occupy; other blocks stay fixed.
  random_group text,

  -- instructions
  body text,
  -- video
  video_path text,
  file_name text,
  -- survey
  prompt text,
  options text[],

  created_at timestamptz not null default now(),

  unique (study_id, label),
  -- Deferred so blocks can be reordered by swapping positions inside one transaction.
  unique (study_id, position) deferrable initially deferred,

  check (type <> 'instructions' or body is not null),
  check (type <> 'video' or (video_path is not null and file_name is not null)),
  check (type <> 'survey' or (prompt is not null and options is not null and cardinality(options) > 0))
);

create index blocks_study_id_idx on public.blocks (study_id);

-- One participant session on the tablet.
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  -- Restrict: a study with collected data cannot be deleted by accident.
  study_id uuid not null references public.studies (id) on delete restrict,
  -- Entered on the tablet at session start. The only participant identifier stored; no names or contact info.
  participant_id text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  -- When the tablet uploaded this run.
  synced_at timestamptz not null default now(),

  -- Lets the tablet retry an upload without creating a duplicate run.
  unique (study_id, participant_id, started_at)
);

create index runs_study_id_idx on public.runs (study_id);

-- One row per time a participant viewed a block. Swiping back to a block creates a new row.
create table public.block_views (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs (id) on delete cascade,
  -- Restrict: a block that has participant data cannot be deleted.
  block_id uuid not null references public.blocks (id) on delete restrict,
  -- Position of this view in the session (1-based).
  view_order integer not null check (view_order > 0),
  -- What the participant saw (video file name or block label), copied at run time so later edits
  -- to the block do not change past data.
  stimulus text not null,
  -- Absolute time the block appeared.
  started_at timestamptz not null,
  -- Milliseconds from the block appearing to the participant swiping away.
  watch_time_ms integer not null check (watch_time_ms >= 0),
  -- True if the participant left this block by swiping back to the previous one.
  swiped_back boolean not null default false,
  -- "Left"/"Right" for videos, the chosen option text for surveys. Null if nothing was pressed.
  button_press text,
  -- Milliseconds from block start to the first button press or survey bubble touch.
  button_time_ms integer check (button_time_ms >= 0),
  -- Absolute times video playback began and ended. Null for non-video blocks.
  video_start_at timestamptz,
  video_end_at timestamptz,

  unique (run_id, view_order),
  check ((button_press is null) = (button_time_ms is null))
);

create index block_views_block_id_idx on public.block_views (block_id);

-- No policies: only the backend (secret key) can read or write.
alter table public.studies enable row level security;
alter table public.blocks enable row level security;
alter table public.runs enable row level security;
alter table public.block_views enable row level security;

-- The flat export layout from the design document: one row per block view.
-- security_invoker makes the view obey the tables' Row Level Security.
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
  r.id as run_id,
  s.id as study_id
from public.block_views v
join public.runs r on r.id = v.run_id
join public.studies s on s.id = r.study_id
join public.blocks b on b.id = v.block_id;
