import type { FormEventHandler, ReactNode } from 'react';
import styles from './StudyBuilder.module.css';
import auth from './LoginForm.module.css';

/** Top bar and centred card shared by the sign-in, forgot-password and new-password pages. */
export default function AuthFrame({
  title,
  intro,
  onSubmit,
  children,
}: {
  title: string;
  intro?: ReactNode;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}) {
  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.bu}>BU</span>
          <span className={styles.brandDivider} />
          <strong>STAR LAB</strong>
        </div>
      </header>
      <main className={auth.page}>
        <form className={auth.card} onSubmit={onSubmit} noValidate>
          <div className={auth.heading}>
            <h1 className={auth.title}>{title}</h1>
            {intro && <p className={auth.intro}>{intro}</p>}
          </div>
          {children}
        </form>
      </main>
    </div>
  );
}
