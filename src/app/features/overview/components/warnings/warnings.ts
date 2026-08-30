import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TripService } from '../../../../services/trip';
import { WarningsService, WarningSeverity, Warning } from '../../../../services/warnings';
import { UiService } from '../../../../services/ui';


@Component({
  selector: 'app-warnings',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './warnings.html',
  styleUrls: ['./warnings.css'],
})
export class Warnings {
  tripService = inject(TripService);
  uiService = inject(UiService);
  warningsService = inject(WarningsService);

  onWarningClick(warning: Warning): void {
    if (!warning.placeId) return;

    // Find the place/route using the placeId/routeId attached to the warning
    const trip = this.tripService.trip();
    const place = trip?.placesArray().find(p => p.id === warning.placeId);
    const route = trip?.routesArray().find(r => r.id === warning.routeId);

    if (place && place.visits().length > 0) {
      this.uiService.triggerFlyTo({center: [place.lng, place.lat]});
      this.uiService.selectVisit(place.visits()[0].id);
    } else if (route) {
      const places = [route?.source, route?.target];
      if (!places[0] || !places[1]) return;
      this.uiService.triggerFlyTo({center: route.middlePoint()});
      this.uiService.selectRoute(route.id);
    }
  }

  severityColor(severity: WarningSeverity): string {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warn':  return '#f59e0b';
      case 'info':  return '#60a5fa';
    }
  }
}
