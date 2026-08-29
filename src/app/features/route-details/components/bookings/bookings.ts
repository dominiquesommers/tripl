import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../../services/trip';
import { LucideAngularModule } from 'lucide-angular';
import { CostBadge } from '../../../../components/ui/cost-badge/cost-badge';
import { CostBreakdown } from '../../../../models/cost';
import { Route, UpdateRoute } from '../../../../models/route';
import { RouteBookings } from './route-bookings/route-bookings'
import { ROUTE_COLORS, ROUTE_ICONS } from '../../../../components/map-handler/config/map-styles.config';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RouteBookings, CostBadge],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings {
  public tripService = inject(TripService);
  route = input.required<Route>();

  updateRoute(route: Route, patch: UpdateRoute) {
    this.tripService.updateRoute(route.id, patch).subscribe();
  }

  actualCost = computed(() => {
    const traverses = this.route().traverses().filter(t => t.inItinerary());
    const sum = traverses.reduce(
      (total, t) => total.add(t.cost_().actual),
      CostBreakdown.empty()
    );
    return sum.transport > 0 ? Math.round(sum.transport / traverses.length) : null;
  });

  routeIcon = computed(() => ROUTE_ICONS[this.route().type() as keyof typeof ROUTE_ICONS]);

  routeColor = computed(() => {
    return '#FFFFFF';
    // ROUTE_COLORS[this.route().type() as keyof typeof ROUTE_COLORS])
  });

  step = computed(() => {
    return {
      taxi: 10,
      flying: 50,
      driving: 20,
      bus: 10,
      train: 10,
      boat: 10,
      walking: 10,
      twowheeler: 5,
      other: 10,
    }[this.route().type() as string] ?? 10;
  });

  // ── Aggregates from traverses ────────────────────────────────
  // TODO

  // Total planned nights across all visits to this place
  // totalNights = computed(() =>
  //   this.place().visits().reduce((sum, v) => sum + v.nights(), 0) || 1
  // );
  //
  // // Sum of actual costs across all visits (each visit blends
  // // real expenses for elapsed nights + estimates for remaining)
  // visitsCostActual = computed(() =>
  //   this.place().visits().reduce(
  //     (total, v) => total.add(v.cost().actual),
  //     CostBreakdown.empty()
  //   )
  // );
  //
  // // ── Daily actual costs (per night average) ────────────────
  //
  // actualAccommodation = computed(() => {
  //   const total = this.visitsCostActual().accommodation;
  //   return total > 0 ? Math.round(total / this.totalNights()) : null;
  // });
  //
  // actualFood = computed(() => {
  //   const total = this.visitsCostActual().food;
  //   return total > 0 ? Math.round(total / this.totalNights()) : null;
  // });
  //
  // actualMiscellaneous = computed(() => {
  //   const total = this.visitsCostActual().miscellaneous;
  //   return total > 0 ? Math.round(total / this.totalNights()) : null;
  // });
  //
  // // ── One-time actual costs (totals) ────────────────────────
  //
  // actualActivities = computed(() => {
  //   const total = this.place().oneTimeCost().actual.activities;
  //   return total > 0 ? total : null;
  // });
  //
  // actualNotes = computed(() => {
  //   const total = this.place().oneTimeCost().actual.miscellaneous;
  //   return total > 0 ? total : null;
  // });
  //
  // getActualCost(id: string): number | null {
  //   switch (id) {
  //     case 'accommodation': return this.actualAccommodation();
  //     case 'food':          return this.actualFood();
  //     case 'miscellaneous': return this.actualMiscellaneous();
  //     case 'activities':    return this.actualActivities();
  //     case 'notes':         return this.actualNotes();
  //     default:              return null;
  //   }
  // }
}
