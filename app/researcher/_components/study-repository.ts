import type { SupabaseClient } from '@supabase/supabase-js';
import type { BlockRow, BlockViewRow, RunRow, StudyRow } from '@/app/utils/supabase/database.types';
import { getSupabase, STUDY_MEDIA_BUCKET } from '@/app/utils/supabase/client';
import { createId, plannedUploads, referencedPaths, toStudyRows, type StudyDraft } from './study-model';

export { getSupabase, STUDY_MEDIA_BUCKET };

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

async function countRuns(supabase: SupabaseClient, studyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('study_id', studyId);
  fail(error, 'check runs');
  return count ?? 0;
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
 * Saves edits to a study that has no runs yet (studies with runs are locked in the UI and here).
 * `original` is what the editor loaded; its updated_at guards against overwriting someone else's save.
 * Blocks are replaced wholesale — safe only because no block_views can reference them yet.
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
    if ((await countRuns(supabase, studyId)) > 0) {
      throw new SaveStudyError('Participants have already run this study, so it can no longer be edited.');
    }
    await assertNameFree(supabase, draft.name.trim(), studyId);
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

      const restore = async () => {
        const previous: Partial<StudyRow> = { ...original.study };
        delete previous.id;
        delete previous.created_at;
        await supabase.from('studies').update(previous).eq('id', studyId);
        await supabase.from('blocks').delete().eq('study_id', studyId);
        if (original.blocks.length) {
          await supabase.from('blocks').insert(
            original.blocks.map((block) => {
              const copy: Partial<BlockRow> = { ...block };
              delete copy.created_at;
              return copy;
            })
          );
        }
      };
      const removed = await supabase.from('blocks').delete().eq('study_id', studyId);
      if (removed.error) {
        await restore();
        throw describe(removed.error, 'replace the blocks');
      }
      const inserted = await supabase.from('blocks').insert(rows.blocks);
      if (inserted.error) {
        await restore();
        throw describe(inserted.error, 'save the blocks');
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

/** Deletes a study without runs, its blocks and its files. Studies with runs are refused. */
export async function deleteStudy(supabase: SupabaseClient, studyId: string): Promise<void> {
  try {
    if ((await countRuns(supabase, studyId)) > 0) {
      throw new SaveStudyError('This study has participant data, so it cannot be deleted.');
    }
    const loaded = await getStudy(supabase, studyId);
    if (!loaded) return;
    fail((await supabase.from('blocks').delete().eq('study_id', studyId)).error, 'delete the blocks');
    fail((await supabase.from('studies').delete().eq('id', studyId)).error, 'delete the study');
    const paths = referencedPaths(loaded.study, loaded.blocks);
    if (paths.length)
      await supabase.storage
        .from(STUDY_MEDIA_BUCKET)
        .remove(paths)
        .catch(() => undefined);
  } catch (error) {
    throw wrap(error);
  }
}
