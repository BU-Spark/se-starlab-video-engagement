import { StudyDraft, validateStudy } from './study-model';

/** No HTTP or persistent storage: this service only simulates a save. */
export async function saveDemoStudy(draft: StudyDraft, fail = false): Promise<{ savedAt: string }> {
  if (Object.keys(validateStudy(draft)).length) throw new Error('Complete the required fields before saving.');
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  if (fail) throw new Error('Demo save failed. Your changes are still here. Please try again.');
  return { savedAt: new Date().toISOString() };
}
