import { Component, input, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { OverlayMenuAction } from '../../../models/overlay-menu';
import { UiService } from '../../../services/ui';
import { NotificationService } from '../../../services/notification';

@Component({
  selector: 'app-overlay-menu',
  standalone: true,
  imports: [OverlayModule, LucideAngularModule],
  templateUrl: './overlay-menu.html',
  styleUrl: './overlay-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayMenu<T = void> {
  uiService = inject(UiService);
  notificationService = inject(NotificationService);

  actions = input.required<OverlayMenuAction<T>[]>();
  context = input<T>();
  triggerIcon = input('ellipsis');
  triggerTooltip = input('Options');
  overlayPositions = input<ConnectedPosition[]>([
    // Preferred: bottom-right aligned
    { originX: 'end', originY: 'bottom', overlayX: 'end', offsetX: 2, overlayY: 'top', offsetY: 2 },
    // Fallback 1: top-right aligned
    { originX: 'end', originY: 'top', overlayX: 'end', offsetX: 2, overlayY: 'bottom', offsetY: -2 },
    // Fallback 2: bottom-left aligned (if right side overflows)
    { originX: 'start', originY: 'bottom', overlayX: 'start', offsetX: -2, overlayY: 'top', offsetY: 2 },
    // Fallback 3: top-left aligned
    { originX: 'start', originY: 'top', overlayX: 'start', offsetX: -2, overlayY: 'bottom', offsetY: -2 },
  ]);

  isOpen = signal(false);

  visibleActions = computed(() => {
    const ctx = this.context() as T;
    return this.actions().filter((a) => !a.hidden || !a.hidden(ctx));
  });

  toggle = () => this.isOpen.set(!this.isOpen());
  close = () => this.isOpen.set(false);

  resolveIcon = (action: OverlayMenuAction<T>): string => {
    const ctx = this.context() as T;
    return typeof action.icon === 'function' ? action.icon(ctx) : action.icon;
  };

  resolveLabel = (action: OverlayMenuAction<T>): string => {
    const ctx = this.context() as T;
    return typeof action.label === 'function' ? action.label(ctx) : action.label;
  };

  resolveClassName = (action: OverlayMenuAction<T>): string | undefined => {
    const ctx = this.context() as T;
    return typeof action.className === 'function' ? action.className(ctx) : action.className;
  };

  resolveDisabledReason = (action: OverlayMenuAction<T>): string | false => {
    const ctx = this.context() as T;
    return action.disabled ? action.disabled(ctx) : false;
  };

  resolveTitle = (action: OverlayMenuAction<T>): string => {
    if (this.uiService.isTouchDevice()) return '';
    const reason = this.resolveDisabledReason(action);
    return reason || '';
  };

  handleClick = (action: OverlayMenuAction<T>) => {
    const reason = this.resolveDisabledReason(action);
    if (reason) {
      if (this.uiService.isTouchDevice()) {
        this.notificationService.notify(reason, true);
      }
      return;
    }
    this.run(action);
  };

  private run = (action: OverlayMenuAction<T>) => {
    action.action(this.context() as T);
    this.close();
  };
}