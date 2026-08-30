import {Injectable, inject, computed} from '@angular/core';
import {TripService} from './trip';
import { PlaceBooking } from '../models/place-booking';
import { RouteBooking } from '../models/route-booking';


// ── Warning types ─────────────────────────────────────────
export type WarningSeverity = 'error' | 'warn' | 'info';

export interface Warning {
  id:       string;
  severity: WarningSeverity;
  icon:     string;
  title:    string;
  detail:   string;
  placeId?: string;
  routeId?: string;
}

// ── Thresholds ────────────────────────────────────────────
const DEADLINE_WARN_DAYS = 7;   // warn N days before cancel/pay deadline
const UPCOMING_DAYS      = 90;  // only warn for bookings within N days


@Injectable({ providedIn: 'root' })
export class WarningsService {
  tripService = inject(TripService);

  warnings = computed((): Warning[] => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    if (!trip) return [];

    const today     = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const warnings: Warning[] = [];

    const placeBookings = Array.from(trip.placeBookings().values());
    const routeBookings = Array.from(trip.routeBookings().values());
    const places        = trip.places();
    const routes        = trip.routes();
    const expenses      = trip.expenses();

    // ── 1. Cancellation deadline approaching ──────────────
    for (const b of [...placeBookings, ...routeBookings]) {
      if (!b.cancel_before()) continue;
      const cancelDate = new Date(b.cancel_before()! + 'T00:00:00Z');
      const daysUntil  = this.daysBetween(today, cancelDate);
      if (daysUntil < 0) continue; // already passed
      if (daysUntil <= DEADLINE_WARN_DAYS) {
        const placeId = 'place_id' in b ? b.place_id : undefined;
        const routeId = 'route_id' in b ? b.route_id : undefined;
        const place = placeId ? places.get(placeId) : null;
        const route = routeId ? routes.get(routeId) : null;
        warnings.push({
          id:       `cancel-${b.id}`,
          severity: daysUntil <= 2 ? 'error' : 'warn',
          icon:     'shield',
          title:    `Cancellation deadline in ${daysUntil}d`,
          detail:   `${place?.name() ?? route?.name() ?? 'Booking'} — free cancellation until ${this.formatDate(b.cancel_before()!)}`,
          placeId:  place?.id,
          routeId:  route?.id
        });
      }
    }

    // ── 2. Payment due approaching ─────────────────────────
    for (const b of [...placeBookings, ...routeBookings]) {
      if (!b.pay_by()) continue;
      const payDate   = new Date(b.pay_by()! + 'T00:00:00Z');
      const daysUntil = this.daysBetween(today, payDate);
      if (daysUntil < 0) continue;
      if (daysUntil > DEADLINE_WARN_DAYS) continue;

      // Only warn if not fully paid
      const paid = Array.from(expenses.values())
        .filter(e => e.place_booking_id === b.id)
        .reduce((sum, e) => sum + e.amount(), 0);
      const price = b.final_price() ?? 0;
      if (price > 0 && paid >= price) continue;

      const placeId = 'place_id' in b ? b.place_id : undefined;
      const routeId = 'route_id' in b ? b.route_id : undefined;
      const place = placeId ? places.get(placeId) : null;
      const route = routeId ? routes.get(routeId) : null;
      const outstanding = price - paid;
      warnings.push({
        id:       `pay-${b.id}`,
        severity: daysUntil <= 2 ? 'error' : 'warn',
        icon:     'credit-card',
        title:    `Payment due in ${daysUntil}d`,
        detail:   `${place?.name() ?? route?.name() ?? 'Booking'} — €${outstanding.toFixed(0)} outstanding by ${this.formatDate(b.pay_by()!)}`,
        placeId:  place?.id,
        routeId:  route?.id
      });
    }

    // ── 3. Unpaid booking (upcoming, no payments at all) ───
    for (const b of [...placeBookings, ...routeBookings]) {
      if (!b.final_price() || b.is_tentative()) continue;

      // Handle check-in date differently depending on whether it's a place or route booking
      const dateStr = 'check_in' in b ? b.check_in() : ('departure_at' in b ? b.departure_at() : null);
      if (!dateStr) continue;

      // Handle datetime vs date string safely (extracting just the YYYY-MM-DD part if it includes time)
      const dateOnly = dateStr.split('T')[0];
      const checkIn = new Date(dateOnly + 'T00:00:00Z');

      const daysUntil = this.daysBetween(today, checkIn);
      if (daysUntil < 0 || daysUntil > UPCOMING_DAYS) continue;

      // Check payments linked to either place_booking_id or route_booking_id
      const paid = Array.from(expenses.values())
        .filter(e => e.place_booking_id === b.id || e.route_booking_id === b.id)
        .reduce((sum, e) => sum + e.amount(), 0);
      if (paid > 0) continue; // at least something paid

      // Safe ID and entity resolution
      const placeId = 'place_id' in b ? b.place_id : undefined;
      const routeId = 'route_id' in b ? b.route_id : undefined;
      const place = placeId ? places.get(placeId) : null;
      const route = routeId ? routes.get(routeId) : null;

      warnings.push({
        id:       `unpaid-${b.id}`,
        severity: 'info',
        icon:     'banknote',
        title:    'Booking not paid',
        detail:   `${place?.name() ?? route?.name() ?? 'Booking'} — €${b.final_price()} due, no payments recorded`,
        placeId:  place?.id,
        routeId:  route?.id
      });
    }

    // ── 4. Double place booking (confirmed overlap) ─────────────
    const confirmedPlaceBookings = placeBookings.filter(b => !b.is_tentative() && b.check_in() && b.check_out());
    for (let i = 0; i < confirmedPlaceBookings.length; i++) {
      for (let j = i + 1; j < confirmedPlaceBookings.length; j++) {
        const a = confirmedPlaceBookings[i];
        const b = confirmedPlaceBookings[j];
        if (this.placeBookingsOverlap(a, b)) {
          const placeA = places.get(a.place_id);
          const placeB = places.get(b.place_id);
          warnings.push({
            id:       `overlap-${a.id}-${b.id}`,
            severity: 'error',
            icon:     'triangle-alert',
            title:    'Double booking detected',
            detail:   `${placeA?.name() ?? 'Booking'} and ${placeB?.name() ?? 'Booking'} have overlapping dates`,
            placeId: placeA?.id
          });
        }
      }
    }

    // ── 4. Double route booking (confirmed overlap) ─────────────
    const confirmedRouteBookings = routeBookings.filter(b => !b.is_tentative() && b.departure_at() && b.arrival_at());
    for (let i = 0; i < confirmedRouteBookings.length; i++) {
      for (let j = i + 1; j < confirmedRouteBookings.length; j++) {
        const a = confirmedRouteBookings[i];
        const b = confirmedRouteBookings[j];
        if (this.routeBookingsOverlap(a, b)) {
          const routeA = places.get(a.route_id);
          const routeB = places.get(b.route_id);
          warnings.push({
            id:       `overlap-${a.id}-${b.id}`,
            severity: 'error',
            icon:     'triangle-alert',
            title:    'Double booking detected',
            detail:   `${routeA?.name() ?? 'Booking'} and ${routeB?.name() ?? 'Booking'} have overlapping dates`,
            routeId: routeA?.id
          });
        }
      }
    }

    // ── 5. Tentative booking — cancel deadline approaching ─
    const tentativeBookings = [
      ...placeBookings.filter(b => b.is_tentative() && b.cancel_before()),
      ...routeBookings.filter(b => b.is_tentative() && b.cancel_before()),
    ];
    for (const b of tentativeBookings) {
      const cancelDate = new Date(b.cancel_before()! + 'T00:00:00Z');
      const daysUntil  = this.daysBetween(today, cancelDate);
      if (daysUntil < 0 || daysUntil > DEADLINE_WARN_DAYS) continue;
      const placeId = 'place_id' in b ? b.place_id : undefined;
      const routeId = 'route_id' in b ? b.route_id : undefined;
      const place = placeId ? places.get(placeId) : null;
      const route = routeId ? routes.get(routeId) : null;
      warnings.push({
        id:       `tentative-cancel-${b.id}`,
        severity: 'warn',
        icon:     'help-circle',
        title:    `Tentative booking: cancel by ${this.formatDate(b.cancel_before()!)}`,
        detail:   `${place?.name() ?? route?.name() ?? 'Booking'} — decide in ${daysUntil}d or lose free cancellation`,
        placeId:  place?.id,
        routeId:  route?.id
      });
    }

    // ── 6. Booking dates vs itinerary mismatch ─────────────
    if (plan) {
      for (const b of confirmedPlaceBookings) {
        if (!b.check_in() || !b.check_out()) continue;
        const place = places.get(b.place_id);
        if (!place) continue;

        const visits = place.visits();
        if (!visits.length) continue;

        // Find the first and last visit entry/exit for this place
        const entryDates = visits.map(v => v.entryDate()).filter(Boolean) as Date[];
        const exitDates  = visits.map(v => v.exitDate()).filter(Boolean) as Date[];
        if (!entryDates.length || !exitDates.length) continue;

        const firstEntry = new Date(Math.min(...entryDates.map(d => d.getTime())));
        const lastExit   = new Date(Math.max(...exitDates.map(d => d.getTime())));

        const checkIn  = new Date(b.check_in()!  + 'T00:00:00Z');
        const checkOut = new Date(b.check_out()! + 'T00:00:00Z');

        // Booking starts before first visit or ends after last visit
        const mismatch = checkIn < firstEntry || checkOut > lastExit;
        if (mismatch) {
          warnings.push({
            id:       `mismatch-${b.id}`,
            severity: 'warn',
            icon:     'calendar-x',
            title:    'Booking dates don\'t match itinerary',
            detail:   `${place.name()} — booking ${this.formatDate(b.check_in()!)}–${this.formatDate(b.check_out()!)} vs itinerary ${this.formatDate(this.toISODate(firstEntry))}–${this.formatDate(this.toISODate(lastExit))}`,
            placeId: place.id
          });
        }
      }

      const x: RouteBooking[] = [];
      for (const b of x) { // confirmedRouteBookings) {
        // TODO check properly in confirmedRouteBookings for tours.
        if (!b.departure_at() || !b.arrival_at()) continue;
        const route = routes.get(b.route_id);
        if (!route) continue;

        const traverses = route.traverses();
        if (!traverses.length) continue;

        // Find the first and last visit entry/exit for this place
        const entryDates = traverses.map(v => v.entryDate()).filter(Boolean) as Date[];
        const exitDates  = traverses.map(v => v.exitDate()).filter(Boolean) as Date[];
        if (!entryDates.length || !exitDates.length) continue;

        const firstEntry = new Date(Math.min(...entryDates.map(d => d.getTime())));
        const lastExit   = new Date(Math.max(...exitDates.map(d => d.getTime())));

        const checkIn  = new Date(b.departure_at()!);
        const checkOut = new Date(b.arrival_at()!);

        // Booking starts before first visit or ends after last visit
        const mismatch = checkIn < firstEntry || checkOut > lastExit;
        if (mismatch) {
          warnings.push({
            id:       `mismatch-${b.id}`,
            severity: 'warn',
            icon:     'calendar-x',
            title:    'Booking dates don\'t match itinerary',
            detail:   `${route.name()} — booking ${this.formatDateTime(b.departure_at()!)}–${this.formatDateTime(b.arrival_at()!)} vs itinerary ${this.formatDate(this.toISODate(firstEntry))}–${this.formatDate(this.toISODate(lastExit))}`,
            routeId: route.id
          });
        }
      }
    }

    // Iterate through all places in the trip
    trip.placesArray().forEach(place => {
      const visits = place.visits();
      
      // If the place is in the itinerary, check its expenses
      if (place.inItinerary() && visits.length > 0) {
        // Gather all expenses for this place (food + misc, or general expenses)
        const allExpenses = [
          ...place.foodExpenses(),
          ...place.miscExpenses()
        ];

        allExpenses.forEach(expense => {
          if (!expense.date) return;
          const expenseDate = new Date(expense.date()! + 'T00:00:00Z');

          // Check if the expense date falls within ANY of the place's visit date intervals
          const isWithinAVisit = visits.some(visit => {
            const entry = visit.entryDate();
            const exit = visit.exitDate();
            if (!entry || !exit) return false;

            // Assuming a visit range is inclusive of entry and exit dates
            return expenseDate >= entry && expenseDate <= exit;
          });

          if (!isWithinAVisit) {
            warnings.push({
              id: `expense-mismatch-${expense.id}`,
              title: `Expense Outside Visit Dates`,
              detail: `Expense at "${place.name()}" on ${expense.date()} does not overlap with any of its planned visits.`,
              severity: 'warn',
              icon: 'calendar-x',
              placeId: place.id
            });
          }
        });
      }
    });

    // ── Sort: errors first, then warns, then info ──────────
    const order: Record<WarningSeverity, number> = { error: 0, warn: 1, info: 2 };
    return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
  });

  warningCount = computed(() => this.warnings().length);

  // ── Helpers ───────────────────────────────────────────────

  private placeBookingsOverlap(a: PlaceBooking, b: PlaceBooking): boolean {
    const aIn  = new Date(a.check_in()!  + 'T00:00:00Z');
    const aOut = new Date(a.check_out()! + 'T00:00:00Z');
    const bIn  = new Date(b.check_in()!  + 'T00:00:00Z');
    const bOut = new Date(b.check_out()! + 'T00:00:00Z');
    return aIn < bOut && aOut > bIn;
  }

  private routeBookingsOverlap(a: RouteBooking, b: RouteBooking): boolean {
    const aIn  = new Date(a.departure_at()!);
    const aOut = new Date(a.arrival_at()!);
    const bIn  = new Date(b.departure_at()!);
    const bOut = new Date(b.arrival_at()!);
    return aIn < bOut && aOut > bIn;
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  private formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  private formatDateTime(iso: string): string {
    console.log(iso);
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  private toISODate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}