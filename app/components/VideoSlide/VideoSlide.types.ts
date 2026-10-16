import type { ButtonSide, StudyControlSettings, StudyDisplaySettings } from '@/app/types';

export interface VideoSlideProps {
  /** Preloaded object URL (falls back to the network URL if preloading was skipped) */
  src: string;
  /** Only the visible slide plays; neighbours stay paused and ready */
  active: boolean;
  display: StudyDisplaySettings;
  controls: StudyControlSettings;
  leftIconSrc?: string;
  rightIconSrc?: string;
  /** The button already pressed during this viewing; buttons lock once set */
  response: string | null;
  /** `timeStamp` is the touch time on the performance.now() clock */
  onButton: (side: ButtonSide, timeStamp: number) => void;
}
