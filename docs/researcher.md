# Researcher Frontend

Owner: Engineer 1 / Louis. Stage: create, list, edit, delete studies and inspect/export synced runs, all on Supabase (`studies`, `blocks`, `runs`, `block_views`, Storage).

## 1. Goal and Scope

Researchers can configure a study, add Instructions, Video, and Survey blocks, edit their content, reorder them, preview local files, and save the study to Supabase. They can then find it in the study list, edit it until participants run it, delete it while it has no data, and inspect or download the runs the tablet syncs. Field names follow the `studies` / `blocks` schema; see [Supabase Schema Alignment](supabase-alignment.md).

Saving requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Without them (including CI and the isolated preview) the builder is a local preview with Save disabled, and the list, edit and data pages explain that Supabase is not configured. Duplicating studies and zip export are not available yet. Audio and camera recording can be switched on per study, but the tablet does not record yet.

## 2. Pages and Features

| Route                           | Page                                                                                                     | Buttons                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/researcher/studies`           | Study list: name, block count, runs (completed), last sync, last update                                  | Create new, Refresh; per study: Edit (or View when locked), View data, Delete                              |
| `/researcher/studies/new`       | Study builder                                                                                            | Save study; after saving: View in list, Create another study                                               |
| `/researcher/studies/[id]/edit` | Builder loaded from Supabase                                                                             | Save changes, Discard changes, Delete study (with confirmation), View data when locked                     |
| `/researcher/studies/[id]/data` | Runs: participant, start, Completed/Incomplete, duration, sync time; All / Completed / Incomplete filter | Refresh, Edit/View study, Download CSV (all filtered runs); per run: Inspect ▾ (block views), Download CSV |

Data rules:

- A study with at least one run is **locked**: the editor opens read-only and Delete is disabled, because `block_views` refer to its blocks. Save and delete also re-check the run count immediately before writing. The `blocks_locked_after_runs` trigger in the second migration enforces the same rule in the database.
- Saving an edit is refused if `studies.updated_at` changed since the page loaded (someone else saved); reload to continue.
- Replaced or removed videos/icons are deleted from Storage after a successful save; deleting a study also deletes its files.
- CSV is long format: one row per block view with study, participant and run on every row. Columns: `study_name, study_id, participant_id, run_id, run_started_at, run_completed_at, view_order, block_label, block_type, stimulus, view_started_at, watch_time_ms, button_press, button_time_ms, video_start_at, video_end_at, swiped_back, share_time_ms, share_choice, comment_time_ms, save_time_ms, saved` (`swiped_back` and `saved` are 1/0). Files are UTF-8 with BOM so Excel opens them correctly.

The builder layout follows the design: study settings above the block list, English interface text, white and gray surfaces, and BU-red accents.

- Settings: study name; randomization Off / All blocks / By group (`studies.randomized` + `blocks.random_group`, following the tablet's ordering rule); video progress bar; response buttons; swipe back; and pause.
- Side buttons (tablet right-hand rail): comment, save and share buttons; editable share options (defaults Copy link, Messages, Email, Repost, More); pause while the share/comments panel is open.
- Recording: audio and camera switches, stored for the tablet (marked "Tablet support pending").
- Response buttons: thumbs-down on the left and thumbs-up on the right by default. Researchers can customize labels or select local icons. Disabling the buttons preserves their configuration.
- Every block has a required label (`blocks.label`, the stimulus name in exported data), defaulting to `instruction1`, `video1`, `survey1`; a video's label becomes its file name.
- Instructions: plain-text input.
- Video: select, replace, play, and remove local videos, with validation messages for invalid files; optional caption title and text; researcher-written comments (name, text, optional like count) shown in the tablet's comments panel.
- Survey: edit the question and options, keeping at least two options.
- Reordering and deletion: stable block IDs; moving blocks preserves content; deletion requires confirmation.
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

Deliverables include frontend code, unit and browser tests, CI configuration, and the Supabase alignment notes. Use GitHub Issues for tasks and pull requests for reviews and results; no additional document-approval process is required.
