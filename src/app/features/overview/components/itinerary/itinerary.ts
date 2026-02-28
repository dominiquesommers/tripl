import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../../services/trip';
import { UiService } from '../../../../services/ui';
import { LucideAngularModule } from 'lucide-angular';
import { ROUTE_LUCIDE_ICONS } from '../../../../components/map-handler/config/map-styles.config';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './itinerary.html',
  styleUrl: './itinerary.css'
})
export class Itinerary {
  // Inject the services to access the global trip state and UI state
  public tripService = inject(TripService);
  private uiService = inject(UiService);

  private readonly iconConfig = ROUTE_LUCIDE_ICONS;

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
