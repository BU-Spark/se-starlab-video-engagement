'use client';

import { useState, type FormEvent } from 'react';
import { TabletScreen, tabletStyles } from '../TabletScreen';
import { ParticipantIdScreenProps } from './ParticipantIdScreen.types';
import styles from './ParticipantIdScreen.module.css';

export const ParticipantIdScreen = ({ studyName, onStart, onBack }: ParticipantIdScreenProps) => {
  const [participantId, setParticipantId] = useState('');
  const trimmed = participantId.trim();

  // Starting from the submit tap matters: fullscreen and audio autoplay need a user gesture.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed) onStart(trimmed);
  };

  return (
    <TabletScreen title="Enter Participant ID">
      <p className={tabletStyles.message}>{studyName}</p>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          aria-label="Participant ID"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
        <button type="submit" className={tabletStyles.primaryButton} disabled={!trimmed}>
          Start
        </button>
      </form>
      <button type="button" className={tabletStyles.secondaryButton} onClick={onBack}>
        Back to studies
      </button>
    </TabletScreen>
  );
};
