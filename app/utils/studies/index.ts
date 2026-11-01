/**
 * app/utils/studies/index.ts
 *
 * The single place that decides which backend the tablet app uses:
 * Supabase when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set,
 * otherwise the mock studies in public/mock/studies.json.
 */

import { isSupabaseConfigured } from '@/app/utils/supabase/client';
import { mockRepository } from './mockRepository';
import { supabaseRepository } from './supabaseRepository';
import type { StudyRepository } from './StudyRepository';

export const studyRepository: StudyRepository = isSupabaseConfigured() ? supabaseRepository : mockRepository;
export type { StudyRepository, StudySummary } from './StudyRepository';
