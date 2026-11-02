import type { LikeDislike, StudyControlSettings, StudyDisplaySettings } from '@/app/types';

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
  /** Like or Dislike if already pressed during this viewing; both buttons lock once set */
  response: LikeDislike | null;
  /** `timeStamp` is the touch time on the performance.now() clock */
  onButton: (choice: LikeDislike, timeStamp: number) => void;
  /** The active video started playing (`playing` event); `timeStamp` is on the performance.now() clock */
  onVideoStart?: (timeStamp: number) => void;
  /** The participant tapped to pause; `timeStamp` is on the performance.now() clock */
  onPause?: (timeStamp: number) => void;
  /** Playback resumed after the participant's pause; `timeStamp` is on the performance.now() clock */
  onResume?: (timeStamp: number) => void;
}
