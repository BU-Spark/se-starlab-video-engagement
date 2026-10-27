import { TabletScreen, tabletStyles } from '../TabletScreen';
import { PreloadScreenProps } from './PreloadScreen.types';
import styles from './PreloadScreen.module.css';

const toMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export const PreloadScreen = ({ studyName, progress, error, onRetry, onCancel }: PreloadScreenProps) => {
  const { loadedBytes, totalBytes, filesDone, filesTotal } = progress;
  // Fall back to file counts until the server has reported every file's size.
  const fraction =
    filesTotal === 0 ? 1 : totalBytes > 0 && filesDone < filesTotal ? loadedBytes / totalBytes : filesDone / filesTotal;
  const percent = Math.min(100, Math.round(fraction * 100));

  return (
    <TabletScreen title={studyName}>
      <p className={tabletStyles.message}>{error ? 'Loading failed' : 'Loading study videos…'}</p>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Download progress"
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <p className={tabletStyles.message}>
        {filesDone} / {filesTotal} files · {toMb(loadedBytes)} MB
      </p>
      {error && (
        <>
          <p className={`${tabletStyles.message} ${tabletStyles.error}`}>{error}</p>
          <button type="button" className={tabletStyles.primaryButton} onClick={onRetry}>
            Retry
          </button>
        </>
      )}
      <button type="button" className={tabletStyles.secondaryButton} onClick={onCancel}>
        Back to studies
      </button>
    </TabletScreen>
  );
};
