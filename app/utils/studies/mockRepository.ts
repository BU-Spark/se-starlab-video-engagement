/**
 * app/utils/studies/mockRepository.ts
 *
 * Stand-in for the cloud backend until the studies/runs tables exist.
 * Studies come from public/mock/studies.json; submitted runs are kept in localStorage.
 */

import type { RunResult, Study } from '@/app/types';
import type { StudyRepository, StudySummary } from './StudyRepository';

const STUDIES_URL = '/mock/studies.json';
export const MOCK_RUNS_STORAGE_KEY = 'mock-submitted-runs';

async function fetchStudies(): Promise<Study[]> {
  const response = await fetch(STUDIES_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load studies (${response.status})`);
  }
  return (await response.json()) as Study[];
}

export const mockRepository: StudyRepository = {
  async listStudies(): Promise<StudySummary[]> {
    const studies = await fetchStudies();
    return studies.map(({ id, name }) => ({ id, name }));
  },

  async getStudy(id: string): Promise<Study> {
    const study = (await fetchStudies()).find((s) => s.id === id);
    if (!study) {
      throw new Error(`Study "${id}" not found`);
    }
    return study;
  },

  async submitRun(run: RunResult): Promise<void> {
    const saved = JSON.parse(window.localStorage.getItem(MOCK_RUNS_STORAGE_KEY) ?? '[]') as RunResult[];
    saved.push(run);
    window.localStorage.setItem(MOCK_RUNS_STORAGE_KEY, JSON.stringify(saved));
    console.info('[mockRepository] Run submitted', run);
  },
};
