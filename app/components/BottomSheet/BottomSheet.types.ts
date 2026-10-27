import type { ReactNode } from 'react';

export interface BottomSheetProps {
  /** Accessible name and visible heading */
  heading: string;
  /** Called when the participant taps above the sheet */
  onDismiss: () => void;
  /** Extra class for the sheet panel, e.g. to make it taller */
  className?: string;
  children: ReactNode;
}
