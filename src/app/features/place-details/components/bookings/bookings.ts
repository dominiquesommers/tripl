import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../../services/trip';
import { LucideAngularModule } from 'lucide-angular';
import { Place } from '../../../../models/place';
import { CostBadge } from '../../../../components/ui/cost-badge/cost-badge';
import { CostBreakdown } from '../../../../models/cost';
import { Expenses } from './expenses/expenses'
import { PlaceBookings } from './place-bookings/place-bookings'

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, CostBadge, Expenses, PlaceBookings],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings {
  public tripService = inject(TripService);
  place = input.required<Place>();

  // ── Category config ───────────────────────────────────────

  dailyCategories = [
    { id: 'accommodation', label: 'Accommodation', icon: 'hotel',        step: 10 },
    { id: 'food',          label: 'Food & Drink',  icon: 'utensils',     step: 5  },
    { id: 'miscellaneous', label: 'Miscellaneous', icon: 'shopping-bag', step: 5  },
  ];

  oneTimeCategories = [
    { id: 'activities', label: 'Activities', icon: 'map-pin',      step: 10 },
    { id: 'notes',      label: 'Notes',      icon: 'notebook-pen', step: 10 },
  ];

  getCategoryColor(id: string): string {
    switch (id) {
      case 'accommodation': return '#5dade2';
      case 'food':          return '#58d68d';
      case 'miscellaneous': return '#f39c12';
      case 'activities':    return '#a78bfa';
      case 'notes':         return '#f87171';
      default:              return '#8e8e93';
    }
  }

  // ── Estimated costs (editable for daily, read-only for one-time) ──────

  getEstimatedCost(id: string): number {
    const p = this.place();
    switch (id) {
      case 'accommodation': return p.accommodation_cost() ?? 0;
      case 'food':          return p.food_cost() ?? 0;
      case 'miscellaneous': return p.miscellaneous_cost() ?? 0;
      case 'activities':    return p.oneTimeCost().estimated.activities;
      case 'notes':         return p.oneTimeCost().estimated.miscellaneous;
      default:              return 0;
    }
  }

  updateEstimatedCost(id: string, newValue: number) {
    if (['accommodation', 'food', 'miscellaneous'].includes(id)) {
      this.tripService.updatePlace(this.place().id, {
        [`${id}_cost`]: newValue
      }).subscribe();
    }
    // one-time costs are aggregated from activities/notes — not directly editable here
  }

  // ── Aggregates from visits ────────────────────────────────

  // Total planned nights across all visits to this place
  totalNights = computed(() =>
    this.place().visits().reduce((sum, v) => sum + v.nights(), 0) || 1
  );

  // Sum of actual costs across all visits (each visit blends
  // real expenses for elapsed nights + estimates for remaining)
  visitsCostActual = computed(() =>
    this.place().visits().reduce(
      (total, v) => total.add(v.cost().actual),
      CostBreakdown.empty()
    )
  );

  // ── Daily actual costs (per night average) ────────────────

  actualAccommodation = computed(() => {
    const total = this.visitsCostActual().accommodation;
    return total > 0 ? Math.round(total / this.totalNights()) : null;
  });

  actualFood = computed(() => {
    const total = this.visitsCostActual().food;
    return total > 0 ? Math.round(total / this.totalNights()) : null;
  });

  actualMiscellaneous = computed(() => {
    const total = this.visitsCostActual().miscellaneous;
    return total > 0 ? Math.round(total / this.totalNights()) : null;
  });

  // ── One-time actual costs (totals) ────────────────────────

  actualActivities = computed(() => {
    const total = this.place().oneTimeCost().actual.activities;
    return total > 0 ? total : null;
  });

  actualNotes = computed(() => {
    const total = this.place().oneTimeCost().actual.miscellaneous;
    return total > 0 ? total : null;
  });

  getActualCost(id: string): number | null {
    switch (id) {
      case 'accommodation': return this.actualAccommodation();
      case 'food':          return this.actualFood();
      case 'miscellaneous': return this.actualMiscellaneous();
      case 'activities':    return this.actualActivities();
      case 'notes':         return this.actualNotes();
      default:              return null;
    }
  }
}
