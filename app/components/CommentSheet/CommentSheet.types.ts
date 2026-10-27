import type { VideoComment } from '@/app/types';

export interface CommentSheetProps {
  /** Comments the researcher wrote for this video */
  comments: VideoComment[];
  onClose: () => void;
}
