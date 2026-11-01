export interface ResearcherExitProps {
  /** PIN the researcher must enter to abort the session */
  pin: string;
  onExit: () => void;
}
