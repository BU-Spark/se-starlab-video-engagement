'use client';

import { useRef } from 'react';
import { clsx } from 'clsx';
import { SurveySlideProps } from './SurveySlide.types';
import styles from './SurveySlide.module.css';

export const SurveySlide = ({ block, selected, onChoose }: SurveySlideProps) => {
  // Time of the finger touching down, so the response time isn't delayed until the finger lifts.
  const downAt = useRef<number | null>(null);

  return (
    <div className={styles.slide}>
      <p className={styles.prompt} id={`${block.id}-prompt`}>
        {block.prompt}
      </p>
      <div className={styles.options} role="radiogroup" aria-labelledby={`${block.id}-prompt`}>
        {block.options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected === option}
            className={clsx(styles.option, selected === option && styles.selected)}
            onPointerDown={(e) => {
              downAt.current = e.timeStamp;
            }}
            onClick={(e) => {
              onChoose(option, downAt.current ?? e.timeStamp);
              downAt.current = null;
            }}
          >
            <span className={styles.bubble} aria-hidden="true" />
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};
