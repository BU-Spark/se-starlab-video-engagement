/**
 * app/utils/studies/StudyRepository.ts
 *
 * Everything the tablet app needs from the cloud. The UI only talks to this interface,
 * so swapping the mock for Supabase/FastAPI later means writing one new implementation.
 */

import type { RunResult, Study } from '@/app/types';

export interface StudySummary {
  id: string;
  name: string;
}

export interface StudyRepository {
  listStudies(): Promise<StudySummary[]>;
  getStudy(id: string): Promise<Study>;
  /** Uploads one completed session. Rejects if the upload failed so the caller can queue it. */
  submitRun(run: RunResult): Promise<void>;
}
