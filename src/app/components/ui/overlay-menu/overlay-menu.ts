import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { OverlayMenuAction } from '../../../models/overlay-menu';

@Component({
  selector: 'app-overlay-menu',
  standalone: true,
  imports: [OverlayModule, LucideAngularModule],
  templateUrl: './overlay-menu.html',
  styleUrl: './overlay-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayMenu {
  actions = input.required<OverlayMenuAction[]>();
  triggerIcon = input('ellipsis');
  triggerTooltip = input('Options');
  overlayPositions = input<ConnectedPosition[]>([
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ]);

  isOpen = signal(false);

  toggle = () => this.isOpen.set(!this.isOpen());
  close = () => this.isOpen.set(false);

  run = (action: OverlayMenuAction) => {
    action.action();
    this.close();
  };
}