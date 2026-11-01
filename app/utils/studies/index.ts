/**
 * app/utils/studies/index.ts
 *
 * The single place that decides which backend the tablet app uses.
 * Replace mockRepository with a Supabase/FastAPI implementation once the backend tables exist.
 */

import { mockRepository } from './mockRepository';

export const studyRepository = mockRepository;
export type { StudyRepository, StudySummary } from './StudyRepository';
