export type UploadStatus = 'uploading' | 'saved' | 'queued';

export interface CompletionScreenProps {
  status: UploadStatus;
  onRetry: () => void;
  /** Return to the study list for the next participant */
  onFinish: () => void;
}
