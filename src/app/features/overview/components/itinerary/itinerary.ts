import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../../services/trip';
import { UiService } from '../../../../services/ui';
import { LucideAngularModule } from 'lucide-angular';
import {
  ROUTE_COLORS,
  ROUTE_ICON_MAP,
  ROUTE_LUCIDE_ICONS
} from '../../../../components/map-handler/config/map-styles.config';
import {AuthService} from '../../../../services/auth';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './itinerary.html',
  styleUrl: './itinerary.css'
})
export class Itinerary {
  public tripService = inject(TripService);
  public uiService = inject(UiService);
  public authService = inject(AuthService);

  private readonly iconConfig = ROUTE_LUCIDE_ICONS;

  getRouteIcon(type: string | undefined | null): string {
    if (!type) return 'milestone';
    return ROUTE_ICON_MAP[type.toLowerCase()] || 'milestone';
  }

  getRouteColor(type: string | undefined | null): string {
    if (!type) return ROUTE_COLORS.undefined;
    // @ts-ignore
    return ROUTE_COLORS[type.toLowerCase()] || ROUTE_COLORS.undefined;
  }

  /**
   * Navigates to the details of a specific visit.
   * This will trigger the SidePanel to switch from 'Overview' to 'Place Details'.
   */
  onVisitClick(visit: any): void {
    this.uiService.triggerFlyTo({center: [visit.place.lng, visit.place.lat]});
    this.uiService.selectVisit(visit.id);
    // Note: Since side-panel.html listens to selectedVisit(),
    // it will automatically swap the component for us.
  }

  onRouteClick(event: MouseEvent, route: any) {
    event.stopPropagation();
    this.uiService.selectRoute(route.id);
  }

  /**
   * Maps transit types to Lucide icon names.
   * Add or modify these based on your data structure.
   */
  getTransportIcon(type: string | undefined): string {
    if (!type) return 'move-right';
    const key = type.toLowerCase() as keyof typeof ROUTE_LUCIDE_ICONS;
    return this.iconConfig[key] || 'move-right';
  }
}
