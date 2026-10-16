import { InstructionsSlideProps } from './InstructionsSlide.types';
import styles from './InstructionsSlide.module.css';

export const InstructionsSlide = ({ block }: InstructionsSlideProps) => {
  return (
    <div className={styles.slide}>
      <p className={styles.text}>{block.text}</p>
    </div>
  );
};
