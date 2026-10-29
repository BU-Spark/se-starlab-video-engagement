# Researcher ↔ Supabase ↔ Tablet

Owner: Engineer 1 / Louis. One study has three shapes; this document is the contract between them.

| Shape                       | Where                                               | Used by                     |
| --------------------------- | --------------------------------------------------- | --------------------------- |
| Editor state (`StudyDraft`) | `app/researcher/_components/study-model.ts`         | researcher pages only       |
| Database rows               | `app/utils/supabase/database.types.ts` + migrations | both (via Supabase)         |
| `Study` / `RunResult`       | `app/types/study.types.ts`                          | tablet (contract owner: E2) |

Conversions (all pure functions with unit tests):

```text
StudyDraft ──toStudyRows──▶ studies + blocks ──rowsToStudy──▶ Study          (researcher saves, tablet reads)
StudyDraft ◀─fromStudyRows─ studies + blocks                                    (researcher edit page)
RunResult ──toSubmitRunPayload──▶ submit_run(run jsonb) ──▶ runs + block_views (tablet uploads, researcher reads)
```

- `toStudyRows` / `fromStudyRows`: `app/researcher/_components/study-model.ts`
- `rowsToStudy` / `toSubmitRunPayload` / `runIdFor`: `app/utils/studies/supabaseMapping.ts`
- Tablet repository: `app/utils/studies/supabaseRepository.ts`, selected in `app/utils/studies/index.ts` when the Supabase env vars are set (otherwise the mock JSON is used).

## 1. Migrations (apply in order)

| File                                                     | What it does                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261029000100_tablet_contract.sql` | New columns (below); `blocks.type` renamed to `'instructions'` with a check constraint; one-time fix of randomization data saved by the earlier researcher build; `submit_run(run jsonb)` function. Re-runnable.                                                                                                                                   |
| `supabase/migrations/20261029000200_access_policies.sql` | RLS: anon (tablet) reads studies/blocks/media and writes only through `submit_run`; authenticated (researchers) manage studies and read runs. Private `study-media` bucket. A trigger that refuses block changes once a study has runs. A commented **demo-only** block lets the researcher pages work with the anon key until researchers log in. |

Both files were applied to a PostgreSQL 16 database built from the ER diagram (with legacy rows) and re-applied to check they are idempotent. `submit_run` was tested as `anon`: a retry with the same run id stores nothing new; a bad block id rolls back the whole run; direct inserts into `runs` are refused by RLS.

If the existing schema already has a differently named check constraint on `blocks.type`, drop it before step 3 of the first migration.

## 2. Field mapping

### `studies` ↔ `Study.display` / `Study.controls`

| Researcher UI               | Column                                   | Tablet field                            | Notes                                                      |
| --------------------------- | ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Study name                  | `name` (unique)                          | `name`                                  |                                                            |
| Randomization (see §3)      | `randomized`                             | `randomized`                            |                                                            |
| Video progress bar          | `show_video_bar`                         | `display.videoBar`                      |                                                            |
| Left / right button text    | `left/right_button_text`                 | `display.leftText` / `rightText`        | `''` = no label                                            |
| Left / right button icon    | `left/right_button_icon_path`            | `display.leftIcon` / `rightIcon`        | Storage path → signed URL (2 h); null = default 👎 / 👍    |
| Response buttons            | `show_response_buttons`                  | `controls.responseButtons`              |                                                            |
| Comment button              | `comment_button` _(new)_                 | `controls.commentButton`                |                                                            |
| Save button                 | `save_button` _(new)_                    | `controls.saveButton`                   |                                                            |
| Share button                | `share_button` _(new)_                   | `controls.shareButton`                  |                                                            |
| Share options list          | `share_options text[]` _(new)_           | `display.shareOptions`                  | Kept while the share button is off; null = tablet defaults |
| Pause while panels are open | `pause_on_share` _(new)_                 | `controls.pauseOnShare`                 | Enabled in the UI only when comment or share is on         |
| Swipe back                  | `allow_swipe_back`                       | `controls.swipeUp`                      | `swipeUp` means "may go back"                              |
| Tap to pause                | `allow_pausing`                          | `controls.pausing`                      |                                                            |
| Audio / camera recording    | `audio_record` / `camera_record` _(new)_ | `controls.audioRecord` / `cameraRecord` | Saved now; the tablet does not record yet                  |

### `blocks` ↔ `Study.blocks[]`

| Column                         | Tablet field                                | Notes                                                                      |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------- |
| `id`                           | `id`                                        | Client UUID, stable across reordering; `block_views.block_id` refers to it |
| `position` (1-based)           | array order                                 |                                                                            |
| `type`                         | `type`: `instructions` / `video` / `survey` |                                                                            |
| `label`                        | `label`                                     | Defaults `instruction1`, `video1`, `survey1`; a video takes its file name  |
| `random_group`                 | `randomGroup`                               | See §3                                                                     |
| `body`                         | `text` (instructions)                       |                                                                            |
| `video_path`, `file_name`      | `videoUrl` (signed), `fileName`             |                                                                            |
| `title`, `description` _(new)_ | `title`, `description` (video)              | Blank → null → hidden                                                      |
| `comments jsonb` _(new)_       | `comments` (video)                          | `[{ author, text, likes? }]`; null → "No comments yet"                     |
| `prompt`, `options text[]`     | `prompt`, `options` (survey)                |                                                                            |

### `RunResult` → `runs` + `block_views`

| `RunResult`                                                              | Column                                                                              | Notes                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| `runIdFor(studyId, participantId, startedAtIso)`                         | `runs.id`                                                                           | Deterministic, so retried uploads are ignored (§4) |
| `studyId`, `participantId`                                               | `runs.study_id`, `participant_id`                                                   |                                                    |
| `startedAtIso`, `completedAtIso`                                         | `runs.started_at`, `completed_at`                                                   |                                                    |
| —                                                                        | `runs.synced_at`                                                                    | `now()` inside `submit_run`                        |
| `blockOrder`                                                             | not stored                                                                          | Equal to the views ordered by `view_order`         |
| `rows[].blockId`, `order`, `stimulus`                                    | `block_id`, `view_order`, `stimulus`                                                |                                                    |
| `watchTimeMs`, `buttonPress`, `buttonTimeMs`                             | `watch_time_ms`, `button_press`, `button_time_ms`                                   | Rounded to whole ms                                |
| `swipedUp` 0/1                                                           | `swiped_back` boolean                                                               |                                                    |
| `startedAtIso`                                                           | `block_views.started_at`                                                            |                                                    |
| `shareTimeMs`, `shareChoice`, `commentTimeMs`, `saveTimeMs`, `saved` 0/1 | `share_time_ms`, `share_choice`, `comment_time_ms`, `save_time_ms`, `saved` _(new)_ |                                                    |
| —                                                                        | `video_start_at`, `video_end_at`                                                    | Not produced by the tablet yet; stay null          |

## 3. Randomization rule

The tablet decides order in `app/utils/runner/orderBlocks.ts`, and the researcher UI writes rows to match it:

| Researcher UI | `randomized` | `random_group`                   | Tablet behaviour                                                          |
| ------------- | ------------ | -------------------------------- | ------------------------------------------------------------------------- |
| Off           | `false`      | all null                         | Fixed order                                                               |
| All blocks    | `true`       | all null                         | Every block shuffled                                                      |
| By group      | `false`      | researcher's names; blank = null | Blocks with the same name shuffle among their own positions; others fixed |

"By group" requires at least two blocks with the same name. The first migration converts studies saved by the earlier build (which stored "All blocks" as `randomized` + group `'all'`, and "By group" with `randomized = true`).

## 4. Uploading runs (`submit_run`)

`supabaseRepository.submitRun(run)` calls `rpc('submit_run', { run: toSubmitRunPayload(run, runIdFor(run)) })`.

- **Atomic:** the run and all its views are inserted in one transaction.
- **Idempotent:** `runs.id` is derived from (study, participant, start time), the same identity `TabletApp` uses for its upload queue. If a response is lost and the tablet retries, `on conflict (id) do nothing` makes the retry a no-op.
- **Least privilege:** the function is `security definer`; anon has `execute` on it but no insert rights on `runs` / `block_views`.

## 5. Researcher save, edit and delete

Implemented in [`study-repository.ts`](../app/researcher/_components/study-repository.ts).

Create: check the name is unused → upload files to `study-media` (`{study_id}/icons/{side}-{media_id}-{name}`, `{study_id}/videos/{media_id}-{name}`) → insert the study row → insert all blocks; on failure, inserted rows and uploaded files are removed and the editor keeps its content.

Edit: refused once the study has runs → name check → upload new files → `update … where updated_at = <loaded value>` (zero rows = someone else saved; show a conflict) → replace blocks (safe because no views exist) → delete files no longer referenced.

Delete: refused once the study has runs; otherwise deletes blocks, the study and its files.

## 6. Open questions

- Researcher login (Supabase Auth): until it exists, the researcher pages need the demo-only policies in the second migration.
- Audio / camera recording: stored per study, waiting for tablet support and a place to keep the recordings.
- `video_start_at` / `video_end_at`: should the tablet report them, or should the columns be dropped?
- Regenerate `database.types.ts` with `supabase gen types typescript` once the project is linked.
