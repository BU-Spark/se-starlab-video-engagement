'use client';

import { useCallback, useEffect } from 'react';
import { useSwipe, useWheelStep, type SwipeDirection, type WheelStep } from '@/app/hooks';
import { ReelsViewportProps } from './ReelsViewport.types';
import styles from './ReelsViewport.module.css';

/**
 * Which finger direction advances to the next block.
 * 'up' is TikTok/Reels style: drag the finger up and the next block slides in from below.
 * (The design document literally says "swipe down" for next; set this to 'down' to match that.)
 */
export const NEXT_GESTURE = 'up' as SwipeDirection;
const PREVIOUS_GESTURE: SwipeDirection = NEXT_GESTURE === 'down' ? 'up' : 'down';
/** Next slide sits on the side the finger drags from: above when swiping down, below when swiping up. */
const NEXT_SIDE = NEXT_GESTURE === 'down' ? -1 : 1;

export function ReelsViewport<T extends { id: string }>({
  items,
  index,
  renderSlide,
  onNext,
  onPrevious,
  canGoBack,
}: ReelsViewportProps<T>) {
  const canSwipe = useCallback(
    (direction: SwipeDirection) => direction === NEXT_GESTURE || (canGoBack && index > 0),
    [canGoBack, index]
  );

  const onSwipe = useCallback(
    (direction: SwipeDirection, timeStamp: number) => {
      if (direction === NEXT_GESTURE) onNext(timeStamp);
      else if (direction === PREVIOUS_GESTURE) onPrevious(timeStamp);
    },
    [onNext, onPrevious]
  );

  const { dragY, dragging, wasDrag, handlers } = useSwipe({ onSwipe, canSwipe });

  // Mouse wheel / trackpad on laptops: scrolling down moves to the next block, like YouTube Shorts.
  const onWheel = useWheelStep(
    useCallback(
      (step: WheelStep, timeStamp: number) => {
        const direction = step === 'next' ? NEXT_GESTURE : PREVIOUS_GESTURE;
        if (canSwipe(direction)) onSwipe(direction, timeStamp);
      },
      [canSwipe, onSwipe]
    )
  );

  // Arrow keys make desktop testing easier; tablets have no keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') onSwipe(NEXT_GESTURE, e.timeStamp);
      if (e.key === 'ArrowUp' && canSwipe(PREVIOUS_GESTURE)) onSwipe(PREVIOUS_GESTURE, e.timeStamp);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSwipe, canSwipe]);

  // Keep the neighbours mounted so their videos are decoded and ready the moment they slide in.
  const visible = items.map((item, i) => ({ item, offset: i - index })).filter(({ offset }) => Math.abs(offset) <= 1);

  return (
    <div
      className={styles.viewport}
      {...handlers}
      onWheel={onWheel}
      onClickCapture={(e) => {
        // A drag that ends over a button must not also count as a tap on it.
        if (wasDrag()) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {visible.map(({ item, offset }) => (
        <div
          key={item.id}
          className={styles.slide}
          aria-hidden={offset !== 0}
          style={{
            transform: `translateY(calc(${offset * NEXT_SIDE * 100}% + ${dragY}px))`,
            transition: dragging ? 'none' : undefined,
          }}
        >
          {renderSlide(item, offset === 0)}
        </div>
      ))}
    </div>
  );
}
