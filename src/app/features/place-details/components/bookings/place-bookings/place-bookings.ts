import {
  Component, inject, input, computed, signal,
  ViewChildren, QueryList, ElementRef, HostListener, effect, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TripService } from '../../../../../services/trip';
import { Place } from '../../../../../models/place';
import { PlaceBooking, UpdatePlaceBooking } from '../../../../../models/place-booking';
import { FoodInclusion, FOOD_PCT } from '../../../../../models/route-booking';
import { Expense, NewExpense } from '../../../../../models/expense';
import {EditableBadge} from '../../../../../components/ui/editable-badge/editable-badge';
import {DatePicker} from '../../../../../components/ui/date-picker/date-picker';
import {PopupService} from '../../../../../services/popup';
import {CostPopup} from '../../../../../components/ui/cost-popup/cost-popup';
import {RichTextarea} from '../../../../../components/ui/rich-textarea/rich-textarea';


@Component({
  selector: 'app-place-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, EditableBadge, DatePicker, RichTextarea],
  templateUrl: './place-bookings.html',
  styleUrls: ['./place-bookings.css'],
})
export class PlaceBookings {

  tripService = inject(TripService);
  popupSvc    = inject(PopupService);
  place       = input.required<Place>();

  // ── Bookings sorted by check-in ───────────────────────────
  bookings = computed(() =>
    Array.from(this.tripService.trip()?.placeBookings().values() ?? [])
      .filter(b => b.place_id === this.place().id)
      .sort((a, b) => (a.check_in() ?? '').localeCompare(b.check_in() ?? ''))
  );

  // ── Expanded state ────────────────────────────────────────
  expandedId = signal<string | null>(null);

  toggleExpanded(id: string) {
    this.expandedId.update(cur => cur === id ? null : id);
  }

  constructor() {
    effect(() => {
      const place = this.place();
      const bookings = this.bookings();
      const needsFetching = bookings.length > 0 && bookings.some(b => !b.detailsFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchPlaceBookingDetails(place.id).subscribe();
        });
      }
    });
  }

  // ── Add booking immediately ───────────────────────────────
  addBooking() {
    this.tripService.addPlaceBooking(this.place().id).subscribe(b => {
      if (b) this.expandedId.set(b.id);
    });
  }

  // ── Update booking ────────────────────────────────────────
  updateBooking(booking: PlaceBooking, updates: UpdatePlaceBooking) {
    this.tripService.updatePlaceBooking(booking.id, updates).subscribe();
  }

  deleteBooking(booking: PlaceBooking) {
    if (confirm('Remove this booking? Any linked payments will also be removed.')) {
      this.tripService.removePlaceBooking(booking).subscribe();
    }
  }

  // ── Food inclusion ────────────────────────────────────────
  foodOptions: { value: FoodInclusion; label: string }[] = [
    { value: 'breakfast',  label: 'Breakfast'  },
    { value: 'half-board', label: 'Half board' },
    { value: 'full-board', label: 'Full board' },
  ];

  setFoodInclusion(booking: PlaceBooking, value: FoodInclusion) {
    this.updateBooking(booking, { food_pct: FOOD_PCT[value] });
  }

  // ── Booking expenses ──────────────────────────────────────
  bookingExpenses(booking: PlaceBooking): Expense[] {
    return Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => e.place_booking_id === booking.id)
      .sort((a, b) => a.date().localeCompare(b.date()));
  }

  bookingPaidAmount(booking: PlaceBooking): number {
    return this.bookingExpenses(booking).reduce((sum, e) => sum + e.amount(), 0);
  }

  bookingIsPaid(booking: PlaceBooking): boolean {
    const price = booking.final_price();
    if (!price) return false;
    return this.bookingPaidAmount(booking) >= price;
  }

  toggleCancelBefore(booking: PlaceBooking) {
    if (booking.cancel_before()) {
      this.updateBooking(booking, { cancel_before: null });
    } else {
      this.updateBooking(booking, { cancel_before: this.toISODate(new Date()) });
    }
  }

  togglePayBy(booking: PlaceBooking) {
    if (booking.pay_by()) {
      this.updateBooking(booking, { pay_by: null });
    } else {
      this.updateBooking(booking, { pay_by: this.toISODate(new Date()) });
    }
  }

  toggleFoodInclusion(booking: PlaceBooking) {
    if (booking.foodInclusion() === 'excluded') {
      this.setFoodInclusion(booking, 'breakfast');
    } else {
      this.setFoodInclusion(booking, 'excluded');
    }
  }

  // ── Cost popup ────────────────────────────────────────────
  @ViewChildren('priceCellRef') priceCellRefs!: QueryList<ElementRef>;

  openCostPopup(booking: PlaceBooking) {
    const index = this.bookings().findIndex(b => b.id === booking.id);
    const el    = this.priceCellRefs.get(index)?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.popupSvc.open(CostPopup, {
      position: { top: rect.bottom + 8, left: rect.left + rect.width / 2 },
      inputs: { expenses: computed(() => this.bookingExpenses(booking)) },
      outputs: {
        addExpense: (e: NewExpense) => {
          const trip = this.tripService.trip();
          if (!trip) return;
          this.tripService.addExpense({
            ...e,
            place_booking_id: booking.id,
            trip_id: trip.id,
            category: 'accommodation',
          } as NewExpense).subscribe();
        },
        updateExpense: (e: any) =>
          this.tripService.updateExpense(e.id, e).subscribe(),
        deleteExpense: (id: string) => {
          const exp = this.tripService.trip()?.expenses().get(id);
          if (exp) this.tripService.removeExpense(exp).subscribe();
        },
        close: () => this.popupSvc.close(),
      },
    });
  }

  firstUrl(booking: PlaceBooking): string | null {
    const details = booking.details();
    if (!details) return 'https://www.google.com';
    // Match url(href, label) pattern first
    const patternMatch = details.match(/url\(([^,)]+)/);
    if (patternMatch) return patternMatch[1].trim();
    // Fall back to bare URLs
    const urlMatch = details.match(/https?:\/\/[^\s)]+/);
    return urlMatch ? urlMatch[0] : null;
  }

  openUrl(booking: PlaceBooking, event: MouseEvent) {
    event.stopPropagation();
    const url = this.firstUrl(booking);
    if (url) window.open(url, '_blank');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const insidePopup = !!(event.target as HTMLElement).closest('[data-popup]');
    if (!insidePopup && this.popupSvc.isOpen()) this.popupSvc.close();
  }

  // ── Date helpers ──────────────────────────────────────────
  toDate(iso: string | null): Date | null {
    if (!iso) return null;
    return new Date(iso + 'T00:00:00');
  }

  toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
