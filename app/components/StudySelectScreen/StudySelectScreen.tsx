import { TabletScreen, tabletStyles } from '../TabletScreen';
import { StudySelectScreenProps } from './StudySelectScreen.types';
import styles from './StudySelectScreen.module.css';

export const StudySelectScreen = ({
  studies,
  loading,
  error,
  pendingUploads,
  onSelect,
  onReload,
}: StudySelectScreenProps) => {
  return (
    <TabletScreen title="Please Select Study">
      {loading && <p className={tabletStyles.message}>Syncing studies…</p>}
      {error && (
        <>
          <p className={`${tabletStyles.message} ${tabletStyles.error}`}>{error}</p>
          <button type="button" className={tabletStyles.secondaryButton} onClick={onReload}>
            Try again
          </button>
        </>
      )}
      {!loading && !error && studies.length === 0 && <p className={tabletStyles.message}>No studies available.</p>}
      {studies.length > 0 && (
        <ul className={styles.list}>
          {studies.map((study) => (
            <li key={study.id}>
              <button type="button" className={styles.item} onClick={() => onSelect(study.id)}>
                {study.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pendingUploads > 0 && (
        <p className={tabletStyles.message} role="status">
          {pendingUploads} completed session{pendingUploads === 1 ? '' : 's'} waiting to upload
        </p>
      )}
    </TabletScreen>
  );
};
