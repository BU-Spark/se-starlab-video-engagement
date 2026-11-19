# Researcher Frontend

Owner: Engineer 1 / Louis. Stage: create, list, edit, delete studies and inspect/export synced runs, all on Supabase (`studies`, `blocks`, `runs`, `block_views`, Storage).

## 1. Goal and Scope

Researchers can configure a study, add Instructions, Video, and Survey blocks, edit their content, reorder them, preview local files, and save the study to Supabase. They can then find it in the study list, edit it until participants run it, delete it (with its participant data), and inspect or download the runs the tablet syncs. Field names follow the `studies` / `blocks` schema; see [Supabase Schema Alignment](supabase-alignment.md).

Saving requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Without them (including CI and the isolated preview) the builder is a local preview with Save disabled, and the list, edit and data pages explain that Supabase is not configured. Audio and camera recording can be switched on per study; the tablet asks for permission after preloading and records the whole session (HTTPS or localhost only).

## 2. Pages and Features

| Route                           | Page                                                                                                     | Buttons                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/researcher/studies`           | Study list: name, block count, runs (completed), last sync, last update                                  | Create new, Refresh; per study: Edit, View data, Duplicate, Delete                                                          |
| `/researcher/studies/new`       | Study builder                                                                                            | Save study; after saving: View in list, Create another study                                                                |
| `/researcher/studies/[id]/edit` | Builder loaded from Supabase                                                                             | Save changes, Discard changes, Delete study (with confirmation); with runs: a note and View data                            |
| `/researcher/library`           | Block library: every block (grouped by study, filter by type, search) and button icon from all studies   | Tick blocks across studies, choose icons for Like/Dislike, pick the target study (or a new one) and position, Import        |
| `/researcher/studies/[id]/data` | Runs: participant, start, Completed/Incomplete, duration, sync time; All / Completed / Incomplete filter | Refresh, Edit/View study, Download ZIP and Download CSV (all filtered runs); per run: Inspect ▾ (block views), Download CSV |

Data rules:

- A study stays **editable after it has runs**: blocks are saved with an upsert that keeps their ids, so collected `block_views` stay attached. Removing a block that has `block_views` is refused (checked before saving, and by the `blocks_with_data_kept` trigger from `20261117000100_edit_studies_with_runs.sql`). `block_views.stimulus` keeps what each participant saw; the export's Block column shows the current label. **Delete** still works: its confirmation says how many runs go with it, and it also removes the study's videos, icons and recordings.
- Saving an edit is refused if `studies.updated_at` changed since the page loaded (someone else saved); reload to continue.
- Replaced or removed videos/icons are deleted from Storage after a successful save; deleting a study also deletes its files.
- **Duplicate** copies the settings, blocks and Storage files into a new study named `<name> (copy)` (then `(copy 2)`, …) with new block ids and no runs, and opens it in the editor. This is how a locked study is changed for new participants.
- **Download ZIP** contains the combined CSV of the filtered runs plus one CSV per run in `runs/`, named participant + start time.
- CSV is long format: one row per block view with study, participant and run on every row. Columns: `study_name, study_id, participant_id, run_id, run_started_at, run_completed_at, view_order, block_label, block_type, stimulus, view_started_at, watch_time_ms, like_dislike, like_dislike_time_ms, survey_answer, survey_time_ms, video_start_at, video_end_at, swiped_back, pause_count, paused_ms, recording_path, recording_started_at` (`swiped_back` is 1/0). Files are UTF-8 with BOM so Excel opens them correctly.

The builder layout follows the design: study settings above the block list, English interface text, white and gray surfaces, and BU-red accents.

- Settings: study name; randomization Off / All blocks / By group (`studies.randomized` + `blocks.random_group`, following the tablet's ordering rule); video progress bar; response buttons; swipe back; and pause.
- No comment, share or save buttons: they were removed from the study. The tablet's right-hand rail shows only the like / dislike buttons.
- Recording: audio and camera switches. The tablet uploads one file per run to the private `run-recordings` bucket; the data page opens it with **Recording**.
- Response buttons: thumbs-down on the left and thumbs-up on the right by default. Researchers can customize labels or select local icons. Disabling the buttons preserves their configuration.
- Every block has a required label (`blocks.label`, the stimulus name in exported data), defaulting to `instruction1`, `video1`, `survey1`; a video's label becomes its file name.
- Instructions: plain-text input.
- Video: select, replace, play, and remove local videos, with validation messages for invalid files; optional caption title and text.
- Survey: edit the question and options, keeping at least two options.
- Block grid: blocks are compact tiles, three per row (two below 900px, one below 560px), read left to right then down. Each tile shows the label and a summary (instruction text, video thumbnail and caption, survey question and options) and "Needs attention" when a field is invalid. The pencil icon or the tile opens the block's full editor in a popup; a new block opens there straight away.
- Library import (`BlockLibrary.tsx`, also in the builder as "Import from library"): imported blocks get new ids, a "(copy)" label if it is taken, and no random group, and are inserted at the end, the start or after a chosen block. They are unsaved draft changes. Videos and icons keep pointing at the source study's files until the save, which copies them into the study's own folder (`plannedCopies`), so deleting the source study never breaks them. The Block library tab hands its selection to the editor through `sessionStorage` (`queueImport` / `peekImport`).
- Reordering and deletion: drag a tile and drop it on the left or right half of another tile, or use the ← → buttons (keyboard accessible). Stable block IDs; moving blocks preserves content; deletion requires confirmation.
- Required-field validation for names, instructions, questions, and options appears after leaving the corresponding field, without a simulated save.
- Save validates every field, uploads files, inserts the study and blocks, and reports progress and errors. Randomization is only configured here; the tablet applies it.

## 3. Frontend and Backend Collaboration

Engineer 1 owns the interface and the Supabase save path. Engineer 3 owns the Supabase project: schema, row-level security, Storage bucket, and authentication. Engineer 2 owns the tablet runner and must implement the randomization rule in [supabase-alignment.md](supabase-alignment.md#2-randomization-rule-shared-with-the-tablet-app).

`toStudyRows` / `fromStudyRows` in `study-model.ts` are the only mappings between editor state and database rows; `app/utils/studies/supabaseMapping.ts` maps rows to the tablet's `Study` and its `RunResult` back to rows; `csv.ts` builds exports. Both are covered by unit tests (`npm run researcher:unit`). All Supabase calls live in `study-repository.ts`. The earlier [Engineer 3 API Handoff](engineer3-handoff.md) is kept for reference only.

## 4. Current CI

ESLint → unit tests → four real browser tests → production build. All must pass; there is no coverage-percentage gate.

- [Researcher Frontend Tests](researcher-tests.md)
- [CI, Local Commands, and Q2 Demo Guide](researcher-ci.md)

## 5. Running and Delivering

For full frontend development, run `npm run dev` and open http://localhost:3000/researcher/studies/new .

To start an isolated researcher preview:

```powershell
npm run researcher:preview
```

Open http://127.0.0.1:3102/researcher/studies/new .

Run automated checks:

```powershell
npx playwright install chromium
npm run researcher:ci
```

Deliverables include frontend code, unit and browser tests, CI configuration, and the Supabase alignment notes. Integration tasks and their status are tracked in [Integration Tasks](integration-tasks.md); use pull requests for reviews and results. No additional document-approval process is required.
