import type { SurveyBlock } from '@/app/types';

export interface SurveySlideProps {
  block: SurveyBlock;
  /** Currently chosen option, if any (participants may switch) */
  selected: string | null;
  /** `timeStamp` is the touch time on the performance.now() clock */
  onChoose: (option: string, timeStamp: number) => void;
}
