/**
 * app/utils/studies/supabaseRepository.ts
 *
 * StudyRepository backed by the Supabase project the researcher website writes to.
 * Reads studies/blocks and signs media URLs; uploads runs through the submit_run database function,
 * which stores a run and its block views in one transaction and ignores retries of the same run.
 */

import type { RunResult, Study } from '@/app/types';
import { getSupabase, STUDY_MEDIA_BUCKET } from '@/app/utils/supabase/client';
import type { BlockRow, StudyRow } from '@/app/utils/supabase/database.types';
import type { StudyRepository, StudySummary } from './StudyRepository';
import { mediaPathsOf, rowsToStudy, runIdFor, toSubmitRunPayload, type MediaUrls } from './supabaseMapping';

/** Long enough to preload and run a session; files are downloaded before the participant starts. */
const SIGNED_URL_SECONDS = 2 * 60 * 60;

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY).');
  return supabase;
}

async function signedUrls(paths: string[]): Promise<MediaUrls> {
  if (!paths.length) return {};
  const { data, error } = await client().storage.from(STUDY_MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new Error(`Could not prepare media downloads: ${error.message}`);
  const urls: MediaUrls = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
  return urls;
}

export const supabaseRepository: StudyRepository = {
  async listStudies(): Promise<StudySummary[]> {
    const { data, error } = await client().from('studies').select('id,name').order('name');
    if (error) throw new Error(`Could not load studies: ${error.message}`);
    return (data ?? []) as StudySummary[];
  },

  async getStudy(id: string): Promise<Study> {
    const supabase = client();
    const [study, blocks] = await Promise.all([
      supabase.from('studies').select('*').eq('id', id).maybeSingle(),
      supabase.from('blocks').select('*').eq('study_id', id).order('position'),
    ]);
    if (study.error) throw new Error(`Could not load the study: ${study.error.message}`);
    if (blocks.error) throw new Error(`Could not load the study blocks: ${blocks.error.message}`);
    if (!study.data) throw new Error(`Study "${id}" not found`);
    const row = study.data as StudyRow;
    const blockRows = (blocks.data ?? []) as BlockRow[];
    return rowsToStudy(row, blockRows, await signedUrls(mediaPathsOf(row, blockRows)));
  },

  async submitRun(run: RunResult): Promise<void> {
    const payload = toSubmitRunPayload(run, runIdFor(run));
    const { error } = await client().rpc('submit_run', { run: payload });
    if (error) throw new Error(`Upload failed: ${error.message}`);
  },
};
