import { TabletScreen, tabletStyles } from '../TabletScreen';
import { CompletionScreenProps } from './CompletionScreen.types';

const STATUS_TEXT = {
  uploading: 'Saving your responses…',
  saved: 'Your responses have been saved.',
  queued: 'Saved on this tablet. It will upload when the connection is back.',
} as const;

export const CompletionScreen = ({ status, onRetry, onFinish }: CompletionScreenProps) => {
  return (
    <TabletScreen title="Thank you!">
      <p className={tabletStyles.message} role="status">
        {STATUS_TEXT[status]}
      </p>
      {status === 'queued' && (
        <button type="button" className={tabletStyles.secondaryButton} onClick={onRetry}>
          Retry upload
        </button>
      )}
      {status !== 'uploading' && (
        <button type="button" className={tabletStyles.primaryButton} onClick={onFinish}>
          Done
        </button>
      )}
    </TabletScreen>
  );
};
