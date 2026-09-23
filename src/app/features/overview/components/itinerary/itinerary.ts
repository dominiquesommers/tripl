import { AfterViewInit, computed, Component, ElementRef, inject, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../../services/trip';
import { UiService } from '../../../../services/ui';
import { LucideAngularModule } from 'lucide-angular';
import {DatePicker} from '../../../../components/ui/date-picker/date-picker';
import {ROUTE_COLORS, ROUTE_ICONS} from '../../../../components/map-handler/config/map-styles.config';
import {AuthService} from '../../../../services/auth';
import {take} from 'rxjs';
import {Cost, AggregateCostBreakdown} from '../../../../components/ui2/cost/cost';
import { CostComparison } from '../../../../models/cost';
import { Visit } from '../../../../models/visit';


@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, DatePicker, Cost],
  templateUrl: './itinerary.html',
  styleUrl: './itinerary.css'
})
export class Itinerary implements AfterViewInit {
  public tripService = inject(TripService);
  public uiService = inject(UiService);
  public authService = inject(AuthService);

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

  private readonly categoryIcons: Record<string, string> = {
    accommodation: 'bed',
    food: 'utensils',
    transport: 'car',
    miscellaneous: 'shopping-bag'
  };

  private readonly categoryColors: Record<string, string> = {
    accommodation: '#85C1E9',
    food: '#82E0AA',
    transport: '#BB8FCE',
    miscellaneous: '#F8C471'
  };

  breakdownFor(cost: CostComparison): AggregateCostBreakdown[] {
    // Prefer actual category values once real spend exists, else fall back to estimate.
    const source = cost.actual.total > 0 ? cost.actual : cost.estimated;
    return [
      {icon: this.categoryIcons['accommodation'], iconColor: this.categoryColors['accommodation'], label: 'Accommodation', value: source.accommodation},
      {icon: this.categoryIcons['food'], iconColor: this.categoryColors['food'], label: 'Food', value: source.food},
      {icon: this.categoryIcons['transport'], iconColor: this.categoryColors['transport'], label: 'Transport', value: source.transport},
      {icon: this.categoryIcons['miscellaneous'], iconColor: this.categoryColors['miscellaneous'], label: 'Misc', value: source.miscellaneous},
    ];
  }

  private scrollToCurrentVisit() {
    const itinerary = this.tripService.plan()?.itinerary() ?? [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

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
    return ROUTE_ICONS[type as keyof typeof ROUTE_ICONS];
  }

  getRouteColor(type: string | undefined | null): string {
    return ROUTE_COLORS[type as keyof typeof ROUTE_COLORS];
  }

  getBookingStatus(obj: any): string {
    return obj.bookingStatus();
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
    return ROUTE_ICONS[type as keyof typeof ROUTE_ICONS];
  }

  // Helper to convert Signal/string/null value to Date object for app-date-picker
  toDate(dateValue: string | Date | null | undefined): Date | null {
    if (!dateValue) return null;
    return dateValue instanceof Date ? dateValue : new Date(dateValue);
  }

  toISODate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Handle updating the trip's start date
  onStartDateChange(newDate: Date | null): void {
    const plan = this.tripService.plan();
    if (!plan || !newDate) return;

    this.tripService.updateCurrentPlan({ start_date: this.toISODate(newDate) }).subscribe(
      () => {
        console.log('successs')
      }
    );
  }
}
