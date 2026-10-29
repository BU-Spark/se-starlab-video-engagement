import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from './Icon';
import styles from './StudyBuilder.module.css';

export type ResearcherTab = 'list' | 'data' | 'new' | 'edit';

/** Shared researcher chrome: brand bar, navigation, page body and footer. */
export default function ResearcherShell({
  active,
  crumbs,
  children,
}: {
  active: ResearcherTab;
  crumbs: string[];
  children: ReactNode;
}) {
  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.bu}>BU</span>
          <span className={styles.brandDivider} />
          <div>
            <strong>STAR LAB</strong>
            <span>Video experiment platform</span>
          </div>
        </div>
        <span className={styles.researcherBadge}>
          <span />
          Researcher workspace
        </span>
      </header>
      <nav className={styles.nav} aria-label="Researcher navigation">
        <Link
          href="/researcher/studies"
          className={active === 'list' ? styles.activeTab : styles.navLink}
          aria-current={active === 'list' ? 'page' : undefined}
        >
          List of studies
        </Link>
        {active === 'data' && (
          <span className={styles.activeTab} aria-current="page">
            Saved data
          </span>
        )}
        {active === 'edit' && (
          <span className={styles.activeTab} aria-current="page">
            Edit study
          </span>
        )}
        <Link
          href="/researcher/studies/new"
          className={active === 'new' ? styles.activeTab : styles.navLink}
          aria-current={active === 'new' ? 'page' : undefined}
        >
          <Icon name="plus" size={16} />
          Create new
        </Link>
      </nav>
      <main className={styles.main}>
        <div className={styles.breadcrumb}>
          <span>Researcher</span>
          {crumbs.map((crumb, index) => (
            <span key={index} className={styles.crumb}>
              <Icon name="chevron" size={12} />
              <span>{crumb}</span>
            </span>
          ))}
        </div>
        {children}
        <footer className={styles.footer}>
          <span>
            STAR Lab <span className={styles.footerDot}>/</span> Boston University
          </span>
          <span>Researcher workspace</span>
        </footer>
      </main>
    </div>
  );
}
