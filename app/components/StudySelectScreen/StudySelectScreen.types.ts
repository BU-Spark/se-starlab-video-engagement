import type { StudySummary } from '@/app/utils/studies';

export interface StudySelectScreenProps {
  studies: StudySummary[];
  loading: boolean;
  error?: string | null;
  /** Finished sessions saved on the tablet that have not reached the server yet */
  pendingUploads: number;
  onSelect: (studyId: string) => void;
  onReload: () => void;
}
