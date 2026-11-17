import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RUN_RECORDINGS_BUCKET,
  type BlockRow,
  type BlockViewRow,
  type RunRow,
  type StudyRow,
} from '@/app/utils/supabase/database.types';
import { getResearcherSupabase, STUDY_MEDIA_BUCKET } from '@/app/utils/supabase/client';
import {
  copyName,
  copyStudyRows,
  createId,
  plannedCopies,
  plannedUploads,
  referencedPaths,
  toStudyRows,
  type StudyDraft,
} from './study-model';

/** The signed-in researcher's client; null when Supabase is not configured (local preview). */
export const getSupabase = getResearcherSupabase;
export { STUDY_MEDIA_BUCKET };

export type SaveProgress =
  | { stage: 'checking' }
  | { stage: 'uploading'; done: number; total: number }
  | { stage: 'saving' };

export class SaveStudyError extends Error {
  constructor(
    message: string,
    /** Validation key the UI can attach the message to, e.g. "name". */
    readonly field?: string
  ) {
    super(message);
    this.name = 'SaveStudyError';
  }
}

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function describe(error: PostgrestLikeError, action: string): SaveStudyError {
  if (error.code === '23505') return new SaveStudyError('A study with this name already exists.', 'name');
  if (error.code === '42501') {
    return new SaveStudyError('You do not have permission to ' + action + '. Check the Supabase row-level policies.');
  }
  return new SaveStudyError('Could not ' + action + ': ' + error.message);
}

function fail(error: PostgrestLikeError | null, action: string) {
  if (error) throw describe(error, action);
}

// ---------------------------------------------------------------------------
// Reads

export interface StudySummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  blockCount: number;
  runCount: number;
  completedRunCount: number;
  lastSyncedAt: string | null;
}

/** All studies, most recently updated first, with run statistics aggregated client-side. */
export async function listStudies(supabase: SupabaseClient): Promise<StudySummary[]> {
  const [studies, blocks, runs] = await Promise.all([
    supabase.from('studies').select('id,name,created_at,updated_at').order('updated_at', { ascending: false }),
    supabase.from('blocks').select('study_id'),
    supabase.from('runs').select('study_id,completed_at,synced_at'),
  ]);
  fail(studies.error, 'load studies');
  fail(blocks.error, 'load blocks');
  fail(runs.error, 'load runs');
  return (studies.data ?? []).map((study) => {
    const studyRuns = (runs.data ?? []).filter((run) => run.study_id === study.id);
    const lastSyncedAt = studyRuns.reduce<string | null>(
      (latest, run) => (run.synced_at && (!latest || run.synced_at > latest) ? run.synced_at : latest),
      null
    );
    return {
      ...study,
      blockCount: (blocks.data ?? []).filter((block) => block.study_id === study.id).length,
      runCount: studyRuns.length,
      completedRunCount: studyRuns.filter((run) => run.completed_at).length,
      lastSyncedAt,
    };
  });
}

export interface LibraryIcon {
  studyId: string;
  studyName: string;
  /** 'right' is the Like button, 'left' the Dislike button, in the study it came from. */
  side: 'left' | 'right';
  path: string;
}

export interface Library {
  studies: { id: string; name: string; updated_at: string }[];
  /** Every block of every study, by study then position. */
  blocks: BlockRow[];
  icons: LibraryIcon[];
  /** Preview URLs for the videos and icons. */
  signedUrls: Record<string, string>;
}

/** Everything researchers built before (blocks, videos, button icons), for importing into a study. */
export async function loadLibrary(supabase: SupabaseClient): Promise<Library> {
  const [studies, blocks] = await Promise.all([
    supabase
      .from('studies')
      .select('id,name,updated_at,left_button_icon_path,right_button_icon_path')
      .order('updated_at', { ascending: false }),
    supabase.from('blocks').select('*').order('position'),
  ]);
  fail(studies.error, 'load studies');
  fail(blocks.error, 'load blocks');
  const studyRows = studies.data ?? [];
  const order = new Map(studyRows.map((study, index) => [study.id, index]));
  const blockRows = ((blocks.data ?? []) as BlockRow[]).sort(
    (a, b) => (order.get(a.study_id) ?? 0) - (order.get(b.study_id) ?? 0) || a.position - b.position
  );
  const icons: LibraryIcon[] = studyRows.flatMap((study) =>
    (['right', 'left'] as const).flatMap((side) => {
      const path = side === 'right' ? study.right_button_icon_path : study.left_button_icon_path;
      return path ? [{ studyId: study.id, studyName: study.name, side, path }] : [];
    })
  );
  const paths = [...blockRows.map((block) => block.video_path), ...icons.map((icon) => icon.path)].filter(
    (path): path is string => !!path
  );
  return {
    studies: studyRows.map(({ id, name, updated_at }) => ({ id, name, updated_at })),
    blocks: blockRows,
    icons,
    signedUrls: await signPaths(supabase, [...new Set(paths)]),
  };
}

/** The blocks and icon files an import link names (see LibraryPage), with preview URLs. */
export async function loadImport(
  supabase: SupabaseClient,
  blockIds: string[],
  iconPaths: string[]
): Promise<{ blocks: BlockRow[]; signedUrls: Record<string, string> }> {
  let rows: BlockRow[] = [];
  if (blockIds.length) {
    const { data, error } = await supabase.from('blocks').select('*').in('id', blockIds);
    fail(error, 'load the blocks to import');
    // Keep the order the researcher saw in the library.
    rows = blockIds.flatMap((id) => ((data ?? []) as BlockRow[]).filter((row) => row.id === id));
  }
  const paths = [...rows.map((row) => row.video_path), ...iconPaths].filter((path): path is string => !!path);
  return { blocks: rows, signedUrls: await signPaths(supabase, paths) };
}

export interface LoadedStudy {
  study: StudyRow;
  blocks: BlockRow[];
  runCount: number;
}

export async function getStudy(supabase: SupabaseClient, id: string): Promise<LoadedStudy | null> {
  const [study, blocks, runs] = await Promise.all([
    supabase.from('studies').select('*').eq('id', id).maybeSingle(),
    supabase.from('blocks').select('*').eq('study_id', id).order('position'),
    supabase.from('runs').select('id', { count: 'exact', head: true }).eq('study_id', id),
  ]);
  fail(study.error, 'load the study');
  fail(blocks.error, 'load the blocks');
  fail(runs.error, 'load runs');
  if (!study.data) return null;
  return { study: study.data as StudyRow, blocks: (blocks.data ?? []) as BlockRow[], runCount: runs.count ?? 0 };
}

/** Short-lived preview URLs for files in the private bucket. Failures just leave previews empty. */
export async function signPaths(supabase: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(STUDY_MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};
  const urls: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}

/** A short-lived link to a participant recording (private run-recordings bucket). */
export async function recordingUrl(supabase: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(RUN_RECORDINGS_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) throw new SaveStudyError('Could not open the recording: ' + (error?.message ?? 'no link'));
  return data.signedUrl;
}

export async function listRuns(supabase: SupabaseClient, studyId: string): Promise<RunRow[]> {
  const { data, error } = await supabase
    .from('runs')
    .select('*')
    .eq('study_id', studyId)
    .order('started_at', { ascending: false });
  fail(error, 'load runs');
  return (data ?? []) as RunRow[];
}

export async function listBlockViews(supabase: SupabaseClient, runIds: string[]): Promise<BlockViewRow[]> {
  if (!runIds.length) return [];
  const { data, error } = await supabase
    .from('block_views')
    .select('*')
    .in('run_id', runIds)
    .order('run_id')
    .order('view_order');
  fail(error, 'load block views');
  return (data ?? []) as BlockViewRow[];
}

// ---------------------------------------------------------------------------
// Writes

async function assertNameFree(supabase: SupabaseClient, name: string, exceptId?: string) {
  let query = supabase.from('studies').select('id').eq('name', name).limit(1);
  if (exceptId) query = query.neq('id', exceptId);
  const existing = await query;
  fail(existing.error, 'check the study name');
  if (existing.data?.length) throw new SaveStudyError('A study with this name already exists.', 'name');
}

/** Uploads every local file in the draft; returns LocalMedia.id → path and a cleanup for failures. */
async function uploadDraftFiles(
  supabase: SupabaseClient,
  draft: StudyDraft,
  studyId: string,
  onProgress: (progress: SaveProgress) => void
) {
  const storage = supabase.storage.from(STUDY_MEDIA_BUCKET);
  const uploads = plannedUploads(draft, studyId);
  const uploadedPaths: Record<string, string> = {};
  const removeUploads = async () => {
    const paths = Object.values(uploadedPaths);
    if (paths.length) await storage.remove(paths).catch(() => undefined);
  };
  try {
    for (const [index, upload] of uploads.entries()) {
      onProgress({ stage: 'uploading', done: index, total: uploads.length });
      const { error } = await storage.upload(upload.path, upload.media.file, {
        contentType: upload.media.file.type || undefined,
        upsert: false,
      });
      if (error) throw new SaveStudyError('Could not upload ' + upload.media.file.name + ': ' + error.message);
      uploadedPaths[upload.media.id] = upload.path;
    }
  } catch (error) {
    await removeUploads();
    throw error;
  }
  onProgress({ stage: 'uploading', done: uploads.length, total: uploads.length });
  try {
    // Library imports: copy the other study's files into this study's folder.
    for (const copy of plannedCopies(draft, studyId)) {
      const { error } = await storage.copy(copy.media.path, copy.to);
      if (error) throw new SaveStudyError('Could not copy ' + copy.media.name + ': ' + error.message);
      uploadedPaths[copy.media.id] = copy.to;
    }
  } catch (error) {
    await removeUploads();
    throw error;
  }
  return { uploadedPaths, removeUploads };
}

function wrap(error: unknown): SaveStudyError {
  if (error instanceof SaveStudyError) return error;
  return new SaveStudyError(error instanceof Error ? error.message : 'The study could not be saved.');
}

/**
 * Creates a study: uploads local files to Storage, then inserts the studies row and its blocks.
 * supabase-js has no client-side transactions, so a failure after the study insert removes the
 * study (blocks first, in case the FK does not cascade) and the uploaded files.
 * A database function (RPC) can make this atomic later without changing the UI.
 */
export async function createStudyInSupabase(
  supabase: SupabaseClient,
  draft: StudyDraft,
  onProgress: (progress: SaveProgress) => void = () => {}
): Promise<{ id: string }> {
  try {
    onProgress({ stage: 'checking' });
    await assertNameFree(supabase, draft.name.trim());
    const studyId = createId();
    const { uploadedPaths, removeUploads } = await uploadDraftFiles(supabase, draft, studyId, onProgress);
    try {
      onProgress({ stage: 'saving' });
      const rows = toStudyRows(draft, studyId, uploadedPaths);
      fail((await supabase.from('studies').insert(rows.study)).error, 'save the study');
      const blocksInsert = await supabase.from('blocks').insert(rows.blocks);
      if (blocksInsert.error) {
        await supabase.from('blocks').delete().eq('study_id', studyId);
        await supabase.from('studies').delete().eq('id', studyId);
        throw describe(blocksInsert.error, 'save the blocks');
      }
      return { id: studyId };
    } catch (error) {
      await removeUploads();
      throw error;
    }
  } catch (error) {
    throw wrap(error);
  }
}

/**
 * Saves edits to a study in place, also after participants have run it.
 * `original` is what the editor loaded; its updated_at guards against overwriting someone else's save.
 * Blocks keep their ids (updated with an upsert), so collected block_views stay attached to them;
 * a removed block that already has participant data is refused before anything is written.
 */
export async function updateStudyInSupabase(
  supabase: SupabaseClient,
  original: LoadedStudy,
  draft: StudyDraft,
  onProgress: (progress: SaveProgress) => void = () => {}
): Promise<void> {
  const studyId = original.study.id;
  try {
    onProgress({ stage: 'checking' });
    await assertNameFree(supabase, draft.name.trim(), studyId);
    const keptIds = new Set(draft.blocks.map((block) => block.id));
    const removed = original.blocks.filter((block) => !keptIds.has(block.id));
    if (removed.length) {
      const withData = await supabase
        .from('block_views')
        .select('block_id')
        .in(
          'block_id',
          removed.map((block) => block.id)
        )
        .limit(1);
      fail(withData.error, 'check the removed blocks');
      const blocked = removed.find((block) => block.id === withData.data?.[0]?.block_id);
      if (blocked) {
        throw new SaveStudyError(
          `Block "${blocked.label}" has participant data and cannot be removed. Undo its removal to save.`
        );
      }
    }
    const { uploadedPaths, removeUploads } = await uploadDraftFiles(supabase, draft, studyId, onProgress);
    try {
      onProgress({ stage: 'saving' });
      const rows = toStudyRows(draft, studyId, uploadedPaths);
      const studyFields: Partial<StudyRow> = { ...rows.study, updated_at: new Date().toISOString() };
      delete studyFields.id;
      const updated = await supabase
        .from('studies')
        .update(studyFields)
        .eq('id', studyId)
        .eq('updated_at', original.study.updated_at)
        .select('id');
      fail(updated.error, 'save the study');
      if (!updated.data?.length) {
        throw new SaveStudyError('This study was changed or deleted somewhere else. Reload it before saving.');
      }

      const originalIds = new Set(original.blocks.map((block) => block.id));
      const restore = async () => {
        const previous: Partial<StudyRow> = { ...original.study };
        delete previous.id;
        delete previous.created_at;
        await supabase.from('studies').update(previous).eq('id', studyId);
        const added = rows.blocks.map((block) => block.id).filter((id) => !originalIds.has(id));
        if (added.length) await supabase.from('blocks').delete().in('id', added);
        if (original.blocks.length) {
          await supabase.from('blocks').upsert(
            original.blocks.map((block) => {
              const copy: Partial<BlockRow> = { ...block };
              delete copy.created_at;
              return copy;
            })
          );
        }
      };
      if (removed.length) {
        const deleted = await supabase
          .from('blocks')
          .delete()
          .in(
            'id',
            removed.map((block) => block.id)
          );
        if (deleted.error) {
          await restore();
          throw describe(deleted.error, 'remove blocks');
        }
      }
      // Removed first, so a new block may reuse a removed block's label.
      const saved = await supabase.from('blocks').upsert(rows.blocks);
      if (saved.error) {
        await restore();
        throw describe(saved.error, 'save the blocks');
      }

      // Files the saved study no longer references (replaced or removed) can go.
      const keep = new Set(referencedPaths(rows.study, rows.blocks));
      const orphaned = referencedPaths(original.study, original.blocks).filter((path) => !keep.has(path));
      if (orphaned.length)
        await supabase.storage
          .from(STUDY_MEDIA_BUCKET)
          .remove(orphaned)
          .catch(() => undefined);
    } catch (error) {
      await removeUploads();
      throw error;
    }
  } catch (error) {
    throw wrap(error);
  }
}

/**
 * Creates an editable copy of a study (settings, blocks and files, no runs) named "<name> (copy)".
 * Files are copied, not shared, so deleting either study never removes the other's media.
 * On failure, everything already copied or inserted is removed again.
 */
export async function duplicateStudy(supabase: SupabaseClient, studyId: string): Promise<{ id: string }> {
  try {
    const loaded = await getStudy(supabase, studyId);
    if (!loaded) throw new SaveStudyError('This study no longer exists.');
    const names = await supabase
      .from('studies')
      .select('name')
      .like('name', loaded.study.name + ' (copy%');
    fail(names.error, 'check the study name');
    const newId = createId();
    const rows = copyStudyRows(
      loaded.study,
      loaded.blocks,
      newId,
      copyName(
        loaded.study.name,
        (names.data ?? []).map((row) => row.name)
      )
    );

    const storage = supabase.storage.from(STUDY_MEDIA_BUCKET);
    const copied: string[] = [];
    const removeCopies = async () => {
      if (copied.length) await storage.remove(copied).catch(() => undefined);
    };
    try {
      for (const file of rows.files) {
        const { error } = await storage.copy(file.from, file.to);
        if (error) throw new SaveStudyError('Could not copy ' + file.from + ': ' + error.message);
        copied.push(file.to);
      }
      fail((await supabase.from('studies').insert(rows.study)).error, 'save the copy');
      if (rows.blocks.length) {
        const blocksInsert = await supabase.from('blocks').insert(rows.blocks);
        if (blocksInsert.error) {
          await supabase.from('blocks').delete().eq('study_id', newId);
          await supabase.from('studies').delete().eq('id', newId);
          throw describe(blocksInsert.error, 'save the copied blocks');
        }
      }
      return { id: newId };
    } catch (error) {
      await removeCopies();
      throw error;
    }
  } catch (error) {
    throw wrap(error);
  }
}

/**
 * Deletes a study and everything that belongs to it: participant runs and block views, blocks,
 * videos and icons (study-media) and session recordings (run-recordings).
 * The rows go in one transaction (delete_study); the files are removed afterwards. A file that
 * cannot be removed is only left over in Storage, never referenced by the database.
 */
export async function deleteStudy(supabase: SupabaseClient, studyId: string): Promise<void> {
  try {
    const loaded = await getStudy(supabase, studyId);
    if (!loaded) return;
    const runs = await listRuns(supabase, studyId);
    fail((await supabase.rpc('delete_study', { target: studyId })).error, 'delete the study');

    const media = referencedPaths(loaded.study, loaded.blocks);
    const recordings = runs.map((run) => run.recording_path).filter((path): path is string => !!path);
    await Promise.all([
      media.length ? supabase.storage.from(STUDY_MEDIA_BUCKET).remove(media) : null,
      recordings.length ? supabase.storage.from(RUN_RECORDINGS_BUCKET).remove(recordings) : null,
    ]).catch(() => undefined);
  } catch (error) {
    throw wrap(error);
  }
}
