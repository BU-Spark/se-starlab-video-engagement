import { clsx } from 'clsx';
import { TabletScreenProps } from './TabletScreen.types';
import styles from './TabletScreen.module.css';

/** Full-screen black frame shared by the tablet's setup screens (study select, loading, ID, done). */
export const TabletScreen = ({ title, children, className }: TabletScreenProps) => {
  return (
    <section className={clsx(styles.screen, className)}>
      <div className={styles.logo} aria-hidden="true">
        STAR Lab
      </div>
      {title && <h1 className={styles.title}>{title}</h1>}
      <div className={styles.body}>{children}</div>
    </section>
  );
};
