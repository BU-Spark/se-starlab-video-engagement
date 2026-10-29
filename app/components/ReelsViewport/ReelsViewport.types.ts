export interface ReelsViewportProps<T extends { id: string }> {
  /** Blocks in the order this participant sees them */
  items: T[];
  /** Index of the slide currently on screen */
  index: number;
  renderSlide: (item: T, active: boolean) => React.ReactNode;
  /** `timeStamp` is when the finger lifted, on the performance.now() clock */
  onNext: (timeStamp: number) => void;
  onPrevious: (timeStamp: number) => void;
  /** The study's "Swipe Up" control: allow going back to the previous block */
  canGoBack: boolean;
}
