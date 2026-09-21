export interface OverlayMenuAction<T = void> {
  icon: string | ((context: T) => string);
  label: string | ((context: T) => string);
  action: (context: T) => void;
  hidden?: (context: T) => boolean;
  disabled?: (context: T) => string | false;
  className?: string | ((context: T) => string);
}