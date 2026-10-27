import type { ButtonSide, StudyControlSettings, StudyDisplaySettings, VideoComment } from '@/app/types';

export interface VideoSlideProps {
  /** Preloaded object URL (falls back to the network URL if preloading was skipped) */
  src: string;
  /** Only the visible slide plays; neighbours stay paused and ready */
  active: boolean;
  display: StudyDisplaySettings;
  controls: StudyControlSettings;
  leftIconSrc?: string;
  rightIconSrc?: string;
  /** Caption heading from the video block; hidden when blank */
  title?: string;
  /** Caption body from the video block; hidden when blank */
  description?: string;
  /** Comments from the video block, shown in the comments panel */
  comments?: VideoComment[];
  /** Whether the video is saved during this viewing */
  saved?: boolean;
  /** The button already pressed during this viewing; buttons lock once set */
  response: string | null;
  /** `timeStamp` is the touch time on the performance.now() clock */
  onButton: (side: ButtonSide, timeStamp: number) => void;
  /** Share button tapped; `timeStamp` is on the performance.now() clock */
  onShareOpen?: (timeStamp: number) => void;
  /** Share option picked, or "Cancel" */
  onShareChoice?: (choice: string) => void;
  /** Comment button tapped; `timeStamp` is on the performance.now() clock */
  onCommentOpen?: (timeStamp: number) => void;
  /** Save button tapped (toggles); `timeStamp` is on the performance.now() clock */
  onSave?: (timeStamp: number) => void;
}
