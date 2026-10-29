# Researcher Builder ↔ Supabase Schema

Owner: Engineer 1 / Louis. Supersedes the FastAPI contract in [engineer3-handoff.md](engineer3-handoff.md) for study creation: the researcher frontend now writes `public.studies` and `public.blocks` directly with `@supabase/supabase-js` and uploads media to Supabase Storage.

## 1. Field mapping

### `studies`

| UI control                                 | Editor field (`StudySettings`)                                  | Column                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Study name                                 | `name` (trimmed)                                                | `name` (unique)                                                                            |
| Randomization: Off / All blocks / By group | `randomization`                                                 | `randomized` = mode ≠ Off (see §2)                                                         |
| Video progress bar                         | `show_video_bar`                                                | `show_video_bar`                                                                           |
| Response buttons                           | `show_response_buttons`                                         | `show_response_buttons`                                                                    |
| Left / right button text                   | `left_button_text`, `right_button_text` (trimmed, default `''`) | same                                                                                       |
| Left / right button icon                   | `left_button_icon`, `right_button_icon` (local file)            | `left_button_icon_path`, `right_button_icon_path` — Storage path, `null` = default 👎 / 👍 |
| Swipe back                                 | `allow_swipe_back`                                              | `allow_swipe_back`                                                                         |
| Tap to pause                               | `allow_pausing`                                                 | `allow_pausing`                                                                            |
| —                                          | generated with `crypto.randomUUID()`                            | `id`                                                                                       |
| —                                          | database defaults                                               | `created_at`, `updated_at`                                                                 |

### `blocks`

| Column         | Instruction                                 | Video                                                             | Survey                                     |
| -------------- | ------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| `id`           | client UUID, stable across reordering       | ←                                                                 | ←                                          |
| `position`     | 1-based array index at save time            | ←                                                                 | ←                                          |
| `type`         | `'instruction'`                             | `'video'`                                                         | `'survey'`                                 |
| `label`        | “Block label” input, default `instruction1` | default `video1`, replaced by the file name when a file is chosen | default `survey1`                          |
| `random_group` | see §2                                      | ←                                                                 | ←                                          |
| `body`         | instruction text                            | `null`                                                            | `null`                                     |
| `video_path`   | `null`                                      | Storage path                                                      | `null`                                     |
| `file_name`    | `null`                                      | original file name                                                | `null`                                     |
| `prompt`       | `null`                                      | `null`                                                            | survey question                            |
| `options`      | `null`                                      | `null`                                                            | `text[]` of bubble labels in display order |

Survey option IDs exist only as React keys; the database stores labels. `block_views.button_press` should store the chosen label (matching the “Neutral” example in the design document).

## 2. Randomization rule (shared with the tablet app)

The design document asks for full randomization plus “advanced settings” that shuffle subsets while keeping the overall order. The schema expresses this with `studies.randomized` + `blocks.random_group`:

| UI         | `randomized` | `random_group` written                                        |
| ---------- | ------------ | ------------------------------------------------------------- |
| Off        | `false`      | whatever the researcher entered (kept, ignored by the tablet) |
| All blocks | `true`       | `'all'` on every block                                        |
| By group   | `true`       | the entered group name, or `null`                             |

**Tablet rule:** when `randomized` is true, for each distinct non-null `random_group`, shuffle those blocks among the positions they occupy; blocks with `null` stay at their `position`. When `randomized` is false, run strictly by `position`.

Example: positions 1–5 = `[intro(null), v1(A), v2(A), v3(A), survey(null)]` → intro first and survey last, videos shuffled in between.

The editor requires at least two blocks with the same group name in “By group” mode.

## 3. Save sequence

Implemented in [`study-repository.ts`](../app/researcher/_components/study-repository.ts):

1. Check `studies.name` is unused (also handled when insert returns `23505`).
2. Generate the study ID and upload files to bucket `study-media` (override with `NEXT_PUBLIC_SUPABASE_STUDY_BUCKET`):
   - `{study_id}/icons/{left|right}-{media_id}-{safe_file_name}`
   - `{study_id}/videos/{media_id}-{safe_file_name}`
     The per-selection `media_id` keeps paths unique when a file is replaced by one with the same name.
3. Insert the `studies` row, then all `blocks` rows in one insert.
4. On failure, delete inserted rows and uploaded objects, keep the editor content, and show the error. Once saved, the form locks and offers “View in list” and “Create another study”.

### Editing (`updateStudyInSupabase`)

1. Refuse if the study has any `runs` (the UI already shows it read-only).
2. Check the name is unused by other studies; upload newly chosen files.
3. `update studies … where id = ? and updated_at = <loaded value>`, setting `updated_at = now()`. Zero affected rows means someone else saved first → conflict message, nothing else changes.
4. Replace the blocks (delete all, insert the new list). This is safe only because no `block_views` exist yet. If it fails, the previous study row and blocks are written back.
5. Remove Storage objects the old version referenced and the new one does not.

### Deleting (`deleteStudy`)

Refused when the study has runs. Otherwise deletes blocks, the study row, and every referenced Storage object.

### Reading runs

The list aggregates `runs` per study client-side (count, completed count, latest `synced_at`). The data page loads `runs` for one study and `block_views` lazily per run (`in run_id`), joining `block_id → blocks.label` for display and export.

supabase-js has no client transactions. If partial writes become a problem, move step 3 into a Postgres function and call it with `supabase.rpc`; the UI does not need to change.

## 4. Required Supabase setup (needs team agreement)

The frontend uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Without them the page stays a local preview with Save disabled (this is how CI runs). Never expose `SUPABASE_SECRET_KEY` to the browser.

The publishable key acts as the `anon` (or `authenticated`, once researchers log in) role, so the tables and bucket need policies. Starting point, to be tightened when researcher auth is added:

```sql
-- If not already defined by the schema:
alter table public.blocks
  add constraint blocks_study_fk foreign key (study_id) references public.studies(id) on delete cascade;
alter table public.blocks add constraint blocks_study_position_key unique (study_id, position);

alter table public.studies enable row level security;
alter table public.blocks enable row level security;

-- Researchers (replace `authenticated` with `anon` only for a local demo):
create policy "researchers manage studies" on public.studies
  for all to authenticated using (true) with check (true);
create policy "researchers manage blocks" on public.blocks
  for all to authenticated using (true) with check (true);

-- The researcher pages only read participant data; the tablet writes it.
alter table public.runs enable row level security;
alter table public.block_views enable row level security;
create policy "researchers read runs" on public.runs for select to authenticated using (true);
create policy "researchers read block views" on public.block_views for select to authenticated using (true);

insert into storage.buckets (id, name, public) values ('study-media', 'study-media', false)
  on conflict (id) do nothing;
create policy "researchers upload study media" on storage.objects
  for insert to authenticated with check (bucket_id = 'study-media');
create policy "researchers read study media" on storage.objects
  for select to authenticated using (bucket_id = 'study-media');
create policy "researchers delete study media" on storage.objects
  for delete to authenticated using (bucket_id = 'study-media');
```

The schema has no owner column, so every signed-in researcher can see every study. Add `studies.owner_id uuid default auth.uid()` and policies like `using (owner_id = auth.uid())` if studies must be private per researcher.

## 5. Open questions

- Should `blocks.position` start at 1 (current) or 0?
- Do we agree on the §2 tablet rule and the reserved group name `all`?
- `updated_at`: the edit page sets it to `now()` on every save and uses the loaded value for conflict detection. A trigger that overwrites it is also fine.
- Will researchers sign in (Supabase Auth)? This decides the `anon` vs `authenticated` policies above.
- Regenerate `database.types.ts` with `supabase gen types typescript` once the project is linked.
- Optional hard guarantee for the “locked once run” rule, independent of the UI:

  ```sql
  create or replace function public.block_edits_after_runs() returns trigger language plpgsql as $$
  begin
    if exists (select 1 from public.runs where study_id = coalesce(old.study_id, new.study_id)) then
      raise exception 'study has runs and is locked' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end $$;
  create trigger blocks_locked_after_runs before insert or update or delete on public.blocks
    for each row execute function public.block_edits_after_runs();
  ```
