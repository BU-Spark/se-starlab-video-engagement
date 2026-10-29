export interface ParticipantIdScreenProps {
  studyName: string;
  /** Called from the Start tap with the trimmed participant ID */
  onStart: (participantId: string) => void;
  onBack: () => void;
}
