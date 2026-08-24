export interface OverlayMenuAction {
  icon: string;
  label: string;
  action: () => void;
  className?: string; // e.g. 'delete-option', for styling variants
}