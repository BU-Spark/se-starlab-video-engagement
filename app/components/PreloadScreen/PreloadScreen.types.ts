import type { PreloadProgress } from '@/app/utils/preload/preloadStudy';

export interface PreloadScreenProps {
  studyName: string;
  progress: PreloadProgress;
  error?: string | null;
  onRetry: () => void;
  onCancel: () => void;
}
