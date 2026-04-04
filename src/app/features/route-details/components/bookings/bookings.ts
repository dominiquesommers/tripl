import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../../services/trip';
import { LucideAngularModule } from 'lucide-angular';
import { Route } from '../../../../models/route';
import { RouteBookings } from './route-bookings/route-bookings'

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RouteBookings],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings {
  public tripService = inject(TripService);
  route = input.required<Route>();

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
