import { AfterViewInit, Component, ElementRef, inject, QueryList, ViewChildren } from '@angular/core';
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
import {take} from 'rxjs';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './itinerary.html',
  styleUrl: './itinerary.css'
})
export class Itinerary implements AfterViewInit {
  public tripService = inject(TripService);
  public uiService = inject(UiService);
  public authService = inject(AuthService);

  private readonly iconConfig = ROUTE_LUCIDE_ICONS;

  @ViewChildren('visitRow') visitRows!: QueryList<ElementRef>;

  ngAfterViewInit() {
    if (this.visitRows.length > 0) {
      this.scrollToCurrentVisit();
    } else {
      this.visitRows.changes.pipe(take(1)).subscribe(() => {
        this.scrollToCurrentVisit();
      });
    }
  }

  private scrollToCurrentVisit() {
    const itinerary = this.tripService.plan()?.itinerary() ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find index of current or next upcoming visit
    let targetIndex = itinerary.findIndex(v => {
      const entry = v.entryDate();
      const exit  = v.exitDate();
      if (!entry || !exit) return false;
      return today >= entry && today < exit; // currently in this visit
    });

    // No current visit — find next upcoming
    if (targetIndex === -1) {
      targetIndex = itinerary.findIndex(v => {
        const entry = v.entryDate();
        return entry && entry > today;
      });
    }

    if (targetIndex === -1) return; // trip is over or no dates set

    // Scroll to two visits before for natural padding
    const scrollIndex = Math.max(0, targetIndex - 2);
    const rows = this.visitRows.toArray();
    if (rows[scrollIndex]) {
      rows[scrollIndex].nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }


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
