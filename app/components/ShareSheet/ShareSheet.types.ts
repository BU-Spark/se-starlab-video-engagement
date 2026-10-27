export interface ShareSheetProps {
  /** Share targets shown as a row of round icons, e.g. "Copy link". Nothing is actually shared. */
  options: string[];
  /** Called with the tapped option, or "Cancel" when closed without picking one */
  onClose: (choice: string) => void;
}
