import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TripService } from '../../../../services/trip';
import { PlaceBooking } from '../../../../models/place-booking';
import { Place } from '../../../../models/place';

// ── Warning types ─────────────────────────────────────────
export type WarningSeverity = 'error' | 'warn' | 'info';

export interface Warning {
  id:       string;
  severity: WarningSeverity;
  icon:     string;
  title:    string;
  detail:   string;
}

// ── Thresholds ────────────────────────────────────────────
const DEADLINE_WARN_DAYS = 7;   // warn N days before cancel/pay deadline
const UPCOMING_DAYS      = 90;  // only warn for bookings within N days

@Component({
  selector: 'app-warnings',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './warnings.html',
  styleUrls: ['./warnings.css'],
})
export class Warnings {

  tripService = inject(TripService);

  warnings = computed((): Warning[] => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    if (!trip) return [];

    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const warnings: Warning[] = [];

    const placeBookings = Array.from(trip.placeBookings().values());
    const places        = trip.places();
    const expenses      = trip.expenses();

    // ── 1. Cancellation deadline approaching ──────────────
    for (const b of placeBookings) {
      if (!b.cancel_before()) continue;
      const cancelDate = new Date(b.cancel_before()! + 'T00:00:00');
      const daysUntil  = this.daysBetween(today, cancelDate);
      if (daysUntil < 0) continue; // already passed
      if (daysUntil <= DEADLINE_WARN_DAYS) {
        const place = places.get(b.place_id);
        warnings.push({
          id:       `cancel-${b.id}`,
          severity: daysUntil <= 2 ? 'error' : 'warn',
          icon:     'shield',
          title:    `Cancellation deadline in ${daysUntil}d`,
          detail:   `${place?.name() ?? 'Booking'} — free cancellation until ${this.formatDate(b.cancel_before()!)}`,
        });
      }
    }

    // ── 2. Payment due approaching ─────────────────────────
    for (const b of placeBookings) {
      if (!b.pay_by()) continue;
      const payDate   = new Date(b.pay_by()! + 'T00:00:00');
      const daysUntil = this.daysBetween(today, payDate);
      if (daysUntil < 0) continue;
      if (daysUntil > DEADLINE_WARN_DAYS) continue;

      // Only warn if not fully paid
      const paid = Array.from(expenses.values())
        .filter(e => e.place_booking_id === b.id)
        .reduce((sum, e) => sum + e.amount(), 0);
      const price = b.final_price() ?? 0;
      if (price > 0 && paid >= price) continue;

      const place = places.get(b.place_id);
      const outstanding = price - paid;
      warnings.push({
        id:       `pay-${b.id}`,
        severity: daysUntil <= 2 ? 'error' : 'warn',
        icon:     'credit-card',
        title:    `Payment due in ${daysUntil}d`,
        detail:   `${place?.name() ?? 'Booking'} — €${outstanding.toFixed(0)} outstanding by ${this.formatDate(b.pay_by()!)}`,
      });
    }

    // ── 3. Unpaid booking (upcoming, no payments at all) ───
    for (const b of placeBookings) {
      if (!b.final_price() || b.is_tentative()) continue;
      if (!b.check_in()) continue;

      const checkIn   = new Date(b.check_in()! + 'T00:00:00');
      const daysUntil = this.daysBetween(today, checkIn);
      if (daysUntil < 0 || daysUntil > UPCOMING_DAYS) continue;

      const paid = Array.from(expenses.values())
        .filter(e => e.place_booking_id === b.id)
        .reduce((sum, e) => sum + e.amount(), 0);
      if (paid > 0) continue; // at least something paid

      const place = places.get(b.place_id);
      warnings.push({
        id:       `unpaid-${b.id}`,
        severity: 'info',
        icon:     'banknote',
        title:    'Booking not paid',
        detail:   `${place?.name() ?? 'Booking'} — €${b.final_price()} due, no payments recorded`,
      });
    }

    // ── 4. Double booking (confirmed overlap) ─────────────
    const confirmedBookings = placeBookings.filter(b => !b.is_tentative() && b.check_in() && b.check_out());
    for (let i = 0; i < confirmedBookings.length; i++) {
      for (let j = i + 1; j < confirmedBookings.length; j++) {
        const a = confirmedBookings[i];
        const b = confirmedBookings[j];
        if (this.bookingsOverlap(a, b)) {
          const placeA = places.get(a.place_id);
          const placeB = places.get(b.place_id);
          warnings.push({
            id:       `overlap-${a.id}-${b.id}`,
            severity: 'error',
            icon:     'triangle-alert',
            title:    'Double booking detected',
            detail:   `${placeA?.name() ?? 'Booking'} and ${placeB?.name() ?? 'Booking'} have overlapping dates`,
          });
        }
      }
    }

    // ── 5. Tentative booking — cancel deadline approaching ─
    const tentativeBookings = placeBookings.filter(b => b.is_tentative() && b.cancel_before());
    for (const b of tentativeBookings) {
      const cancelDate = new Date(b.cancel_before()! + 'T00:00:00');
      const daysUntil  = this.daysBetween(today, cancelDate);
      if (daysUntil < 0 || daysUntil > DEADLINE_WARN_DAYS) continue;
      const place = places.get(b.place_id);
      warnings.push({
        id:       `tentative-cancel-${b.id}`,
        severity: 'warn',
        icon:     'help-circle',
        title:    `Tentative booking: cancel by ${this.formatDate(b.cancel_before()!)}`,
        detail:   `${place?.name() ?? 'Booking'} — decide in ${daysUntil}d or lose free cancellation`,
      });
    }

    // ── 6. Booking dates vs itinerary mismatch ─────────────
    if (plan) {
      for (const b of confirmedBookings) {
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

        const checkIn  = new Date(b.check_in()!  + 'T00:00:00');
        const checkOut = new Date(b.check_out()! + 'T00:00:00');

        // Booking starts before first visit or ends after last visit
        const mismatch = checkIn < firstEntry || checkOut > lastExit;
        if (mismatch) {
          warnings.push({
            id:       `mismatch-${b.id}`,
            severity: 'warn',
            icon:     'calendar-x',
            title:    'Booking dates don\'t match itinerary',
            detail:   `${place.name()} — booking ${this.formatDate(b.check_in()!)}–${this.formatDate(b.check_out()!)} vs itinerary ${this.formatDate(this.toISODate(firstEntry))}–${this.formatDate(this.toISODate(lastExit))}`,
          });
        }
      }
    }

    // ── Sort: errors first, then warns, then info ──────────
    const order: Record<WarningSeverity, number> = { error: 0, warn: 1, info: 2 };
    return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
  });

  warningCount = computed(() => this.warnings().length);

  // ── Helpers ───────────────────────────────────────────────

  private bookingsOverlap(a: PlaceBooking, b: PlaceBooking): boolean {
    const aIn  = new Date(a.check_in()!  + 'T00:00:00');
    const aOut = new Date(a.check_out()! + 'T00:00:00');
    const bIn  = new Date(b.check_in()!  + 'T00:00:00');
    const bOut = new Date(b.check_out()! + 'T00:00:00');
    return aIn < bOut && aOut > bIn;
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  private formatDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  severityColor(severity: WarningSeverity): string {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warn':  return '#f59e0b';
      case 'info':  return '#60a5fa';
    }
  }
}
