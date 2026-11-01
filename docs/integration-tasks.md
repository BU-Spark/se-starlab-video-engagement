# Integration Tasks

Owner: Engineer 1 / Louis. Last reviewed: 2026-10-31.

This document tracks the work needed to connect the researcher website, Supabase and the tablet app, and the gaps against the client's design document. Each task has an owner, a status and a "done when" check. Update the status here and link the pull request when a task closes.

Roles: **E1** researcher frontend (Louis), **E2** tablet app, **E3** Supabase database.

Status values: `Todo`, `In progress`, `Blocked`, `Done`.

## Summary

| #   | Task                                                    | Owner        | Priority | Status | Depends on |
| --- | ------------------------------------------------------- | ------------ | -------- | ------ | ---------- |
| T1  | Create base tables and apply the contract migrations    | E3           | High     | In progress | —          |
| T2  | Researcher authentication and access policies           | E3 + E1      | Medium   | Todo   | T1         |
| T3  | Tablet records `video_start_at` / `video_end_at`        | E2           | High     | Todo   | —          |
| T4  | Tablet Supabase sync path verified end to end           | E2           | High     | In progress | T1         |
| T5  | Agree on the CSV output format with the client          | E1 + E2 + E3 | Medium   | Todo   | —          |
| T6  | Download all runs as a .zip                             | E1           | Medium   | Done   | —          |
| T7  | Duplicate study (edit a locked study as a copy)         | E1           | Low      | Done   | —          |
| T8  | Images in Instructions blocks (confirm with the client) | E1 + E2 + E3 | Low      | Todo   | —          |
| T9  | End-to-end integration test                             | All          | High     | Todo   | T1, T3, T4 |

## Current State

- The researcher pages (list, builder, edit, duplicate, data with CSV and ZIP) are implemented against Supabase, and the unit tests pass (`npm run researcher:unit`, 24 tests).
- **Local Supabase (branch `integration`):** base tables (`20261018044720_create_study_schema.sql`) and both contract migrations apply cleanly from scratch (`npx supabase db reset`). Verified 2026-11-01 with a browser run: researcher Save → study, blocks and videos in Supabase → tablet lists, preloads and runs it → `submit_run` → View data shows the run; swipe-back rows, retry idempotency, RLS and the lock trigger checked. **The cloud project still needs `npx supabase db push`.**
- `integration` = `supabase-db` + `Louis` (which includes `ReelsFrontend`) + `main`. Demo-only anon policies live in `supabase/seed.sql`, which runs locally only.
- `Louis-frontend` is 8 commits ahead of `main` and not merged yet.

## Branches

| Branch                     | Author               | Contents                                                                                                                                                                        |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main` = `dev`             | Louis (PR #1, 10-18) | First researcher builder page and CI. No tablet app, no Supabase code                                                                                                           |
| `ReelsFrontend`            | Andy Baek (E2)       | Tablet app: study select, preload, participant ID, Reels-style runner, kiosk, side buttons. Last commit 10-26                                                                   |
| `supabase-db`              | Vincent Sun (E3)     | Skeleton from 10-10: FastAPI (`/health`, `/clicks`), `button_clicks` table, Supabase config. Branched from the initial commit, so merging it as is would delete the current app |
| `Louis` = `Louis-frontend` | Louis (E1)           | `ReelsFrontend` merged in, plus researcher list/edit/data pages, Supabase mappings, the two contract migrations and these docs                                                  |

## Architecture Draft v0.1 vs Implementation

| Component in the draft                                                                            | Owner | Implemented                                                                                                                                             | Gap / decision needed                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Researcher Web App: builder, order/UI config, run and sync status, CSV/ZIP                        | E1    | All four                                                                                                                                                | Login (T2)                                                                                                                                                                       |
| Cloud Backend: study versions and run management, study download / data sync, exports from events | E3    | No separate server. Both apps call Supabase directly; `submit_run` (RPC), RLS and the lock trigger act as the backend. Exports are built in the browser | **Decide:** keep Supabase-only, or put the FastAPI skeleton in front. **Study versions** are replaced by "lock after runs + Duplicate"; confirm that this is enough              |
| Database: study definitions and versions, runs and realized block order, raw behavioral events    | E3    | `studies`, `blocks`, `runs`, `block_views` (migrations written by E1)                                                                                   | No version table. Realized order is only implied by `block_views.view_order`. **Stores one summary row per block view, not raw events**: decide whether an event table is needed |
| Media Storage: videos, instruction images, metadata                                               | E3    | Private `study-media` bucket: videos and button icons; file name kept in `blocks.file_name`                                                             | Instruction images (T8)                                                                                                                                                          |
| Tablet App: participant ID, three block types, runner, event recorder                             | E2    | All, with ms timing from `performance.now()`                                                                                                            | Absolute video start/end timestamps (T3)                                                                                                                                         |
| Tablet Local Storage: downloaded study and media, event log / pending uploads                     | E2    | Media preloaded into memory (blob URLs) for the session; finished runs queued in `localStorage` (`pending-runs`) and retried                            | Media is not kept across an app reload; no raw event log                                                                                                                         |
| Flows 1–3: download before the session, run and log locally, upload after the session             | E2    | All three (`getStudy` + preload, runner, `submit_run`)                                                                                                  | Untested against the real database (T4)                                                                                                                                          |

## T1. Create base tables and apply the contract migrations

**Owner:** E3. **Blocks:** every researcher button (Save, list, View data) and the tablet sync.

The two migrations on `Louis-frontend` `ALTER` the tables from the ER diagram, so the tables must exist first.

- [ ] Create `studies`, `blocks`, `runs`, `block_views` from the ER diagram, as a migration file in `supabase/migrations/`
- [ ] Apply, in order:
  - `supabase/migrations/20261029000100_tablet_contract.sql`
  - `supabase/migrations/20261029000200_access_policies.sql`
- [ ] Create the private Storage bucket `study-media` (done: exists, empty)
- [ ] Confirm all three engineers use the same `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] Run `supabase gen types typescript` and replace `app/utils/supabase/database.types.ts`

Field-by-field contract: [Supabase Schema Alignment](supabase-alignment.md), sections 1–2.

**Done when:** a researcher saves a study at `/researcher/studies/new`, and the study row, its blocks and the uploaded files appear in Supabase.

## T2. Researcher authentication and access policies

**Owner:** E3 (Auth and RLS), E1 (login page).

Participant data must be visible only to authorized researchers (IRB requirement in the project brief). The researcher pages have no login yet and need the demo-only anon policies commented in `20261029000200_access_policies.sql`.

- [ ] Choose the Supabase Auth method (email/password or magic link) and create researcher accounts
- [ ] Keep the RLS design: anon (tablet) reads studies, blocks and media and writes only through `submit_run`; authenticated users manage studies and read `runs` / `block_views`
- [ ] Until auth is ready, enable the demo-only anon policies **on the dev project only**, and note it in the README
- [ ] E1: login page and session handling under `/researcher`

**Done when:** signed-out users cannot read `runs` / `block_views`, and signed-in researchers can use every researcher page.

## T3. Tablet records `video_start_at` / `video_end_at`

**Owner:** E2. **Priority:** high. This is the Milestone 3 client checkpoint: a tablet prototype that plays videos in sequence and records accurate begin/end timestamps.

The data spec requires `Video_start_timestamp` and `Video_end_timestamp` (system clock, ms precision). `block_views.video_start_at` / `video_end_at` exist and the researcher CSV exports them, but `BlockResult` has no such fields, so they are always empty.

- [ ] Add the two timestamps to `BlockResult` in `app/types/study.types.ts`
- [ ] Capture them when playback actually starts (`playing` event) and when it ends or the participant swipes away; define "end" for looping videos and swipe-away
- [ ] Map them in `toSubmitRunPayload` (`app/utils/studies/supabaseMapping.ts`) and in `submit_run`
- [ ] Measure accuracy on the target tablet (`performance.timeOrigin + performance.now()` vs `Date.now()`)

**Done when:** the CSV from `/researcher/studies/[id]/data` has ms-precision `video_start_at` / `video_end_at` for every video view.

## T4. Tablet Supabase sync path verified end to end

**Owner:** E2. **Depends on:** T1.

- [ ] With the shared `.env.local`, `app/utils/studies/index.ts` selects `supabaseRepository`, not the mock JSON
- [ ] The tablet lists studies saved by the researcher pages, and preload downloads every video before the Participant ID screen
- [ ] A finished run uploads through `submit_run`; a retry after a simulated network failure creates no duplicate run
- [ ] Swiping back creates a new row, with `swiped_back = 1` on the row that was left
- [ ] Survey: `button_time_ms` is the first bubble touch and `button_press` the final (changeable) choice. Video: only one response button, which cannot be switched

**Done when:** a run made on the tablet appears on the researcher Data page with the right run count and last sync time.

## T5. Agree on the CSV output format with the client

**Owner:** E1 (export), with E2 and E3.

| Client specification                                                                                                                                     | Current export                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Button_press` = `0` when none                                                                                                                           | empty cell                                                  |
| `Button_time` = `0` when none                                                                                                                            | empty cell                                                  |
| `Watch_time` written as `10000 ms`                                                                                                                       | integer milliseconds (`watch_time_ms`)                      |
| Columns `Study_ID, Participant_ID, Block, Order, Stimuli, Watch_time, Swipe_back, Button_press, Button_time, Video_start_timestamp, Video_end_timestamp` | snake_case names, plus run, share, comment and save columns |

- [ ] Ask at the next client meeting: empty or `0`, unit suffix or not, are the extra columns welcome
- [ ] Update `app/researcher/_components/csv.ts` and `csv.test.ts` to match
- [ ] Align or remove the tablet's local `app/utils/runner/toCsvRows.ts`

**Done when:** the client confirms a sample CSV.

## T6. Download all runs as a .zip

**Status:** Done in code (`zip.ts`, `buildRunsZip` in `csv.ts`, unit-tested; the archive opens with Windows Expand-Archive). Not yet tried against real runs, which needs T1 and T4.

**Owner:** E1.

The design document asks that the researcher "be able to download all runs as a zip file". The Data page currently merges all runs into one CSV.

- [ ] "Download all (.zip)" on `/researcher/studies/[id]/data`
- [ ] One CSV per run (`{participant}_{date}.csv`) plus the combined CSV
- [ ] Respects the All / Completed / Incomplete filter
- [ ] Unit test for file names and contents

## T7. Duplicate study

**Status:** Done in code (`copyStudyRows` / `copyName` in `study-model.ts`, `duplicateStudy` in `study-repository.ts`, unit-tested). Not yet tried against Supabase, which needs T1. Storage copying uses the existing select + insert policies on `study-media`.

**Owner:** E1.

A study is locked once it has runs, so collected data keeps its meaning. Researchers still need to "edit experiments using the same UI", so they need an editable copy.

- [ ] "Duplicate" on the study list and in the locked editor
- [ ] Copies settings and blocks with new block ids and the name "<name> (copy)"; copies or reuses Storage files
- [ ] Opens the copy in the editor

## T8. Images in Instructions blocks

**Owner:** E1 (builder), E2 (tablet display), E3 (column).

The project description calls Instructions "static text/image screens"; the design document mentions only text. Only text is supported today.

- [ ] Ask the client whether images are needed
- [ ] If yes: `blocks.image_path` (E3), an image picker in the builder (E1), display in `InstructionsSlide` (E2)

## T9. End-to-end integration test

**Owner:** all. **Depends on:** T1, T3, T4.

Each line is one researcher button or flow:

- [ ] `/researcher/studies/new` → **Save study**: study, blocks and files are in Supabase
- [ ] The tablet lists the study, preloads it, runs it with a Participant ID and uploads it
- [ ] `/researcher/studies` → **Refresh**: run count and last sync update
- [ ] `/researcher/studies/[id]/data` → **Inspect ▾** shows block views; **Download CSV** works per run and for all runs
- [ ] Randomization Off / All blocks / By group give the expected orders across runs
- [ ] After a run: **Edit** opens read-only, **Delete** is disabled, and direct block changes are refused by the database trigger
- [ ] Record the results and share them with the client (Milestone 4)

## Change Log

| Date       | Change                                                   |
| ---------- | -------------------------------------------------------- |
| 2026-10-31 | Created from a review against the client design document |
| 2026-10-31 | T6 and T7 implemented in the researcher frontend         |
| 2026-11-01 | T1/T4 verified locally on `integration`; cloud push pending |
