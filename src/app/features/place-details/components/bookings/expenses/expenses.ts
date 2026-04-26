import {Component, inject, input, signal, computed, effect, untracked} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TripService } from '../../../../../services/trip';
import { Place } from '../../../../../models/place';
import { Expense, NewExpense, UpdateExpense } from '../../../../../models/expense';
import {DatePicker} from '../../../../../components/ui/date-picker/date-picker';
import {EditableBadge} from '../../../../../components/ui/editable-badge/editable-badge';
import {RichTextarea} from '../../../../../components/ui/rich-textarea/rich-textarea';


// import { Component, inject, input, signal, computed } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { LucideAngularModule } from 'lucide-angular';
// import { TripService } from '../../../../../services/trip';
// import { Place } from '../../../../../models/place';
// import { Expense, NewExpense, UpdateExpense } from '../../../../../models/expense';
// import { EditableBadge } from '../../../ui/editable-badge/editable-badge';
// import { DatePicker } from '../../../ui/date-picker/date-picker';


type ExpenseCategory = 'food' | 'miscellaneous';


@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, EditableBadge, DatePicker, RichTextarea],
  templateUrl: './expenses.html',
  styleUrls: ['./expenses.css'],
})
export class Expenses {

  tripService = inject(TripService);
  place       = input.required<Place>();

  // ── Expenses sorted newest first ──────────────────────────
  expenses = computed(() =>
    [...this.place().foodExpenses(), ...this.place().miscExpenses()]
      .sort((a, b) => b.date().localeCompare(a.date()))
  );

  // ── Expanded subcategory rows ─────────────────────────────
  expandedIds = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      const place = this.place();
      const needsFetching = this.expenses().length > 0 && this.expenses().some(b => !b.detailsFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchExpenseDetails(place.id, 'place').subscribe()
          // this.tripService.fetchPlaceBookingDetails(place.id).subscribe();
        });
      }
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpanded(id: string, event: MouseEvent) {
    event.stopPropagation();
    this.expandedIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Add expense immediately ───────────────────────────────
  addNew() {
    const trip = this.tripService.trip();
    if (!trip) return;
    this.tripService.addExpense({
      amount:      0,
      date:        this.toISODate(new Date()),
      category:    'food',
      subcategory: null,
      details:     null,
      place_id:    this.place().id,
      trip_id:     trip.id,
    } as NewExpense).subscribe();
  }

  // ── Update expense fields ─────────────────────────────────

  updateDate(expense: Expense, date: Date | null) {
    if (!date) return;
    this.tripService.updateExpense(expense.id, {
      date: this.toISODate(date)
    }).subscribe();
  }

  updateAmount(expense: Expense, amount: number) {
    this.tripService.updateExpense(expense.id, { amount }).subscribe();
  }

  updateDetails(expense: Expense, details: string) {
    this.tripService.updateExpense(expense.id, {
      details: details || null
    }).subscribe();
  }

  updateSubcategory(expense: Expense, subcategory: string) {
    this.tripService.updateExpense(expense.id, {
      subcategory: subcategory || null
    }).subscribe();
  }

  toggleCategory(expense: Expense) {
    const next: ExpenseCategory =
      expense.category() === 'food' ? 'miscellaneous' : 'food';
    this.tripService.updateExpense(expense.id, { category: next }).subscribe();
  }

  deleteExpense(expense: Expense) {
    this.tripService.removeExpense(expense).subscribe();
  }

  // ── Display helpers ───────────────────────────────────────

  categoryIcon(cat: string | null): string {
    return cat === 'food' ? 'utensils' : 'shopping-bag';
  }

  categoryColor(cat: string | null): string {
    return cat === 'food' ? '#58d68d' : '#f39c12';
  }

  // Format: Mon 03-04-'26
  formatDate(isoDate: string): string {
    const d = new Date(isoDate + 'T00:00:00');
    const day  = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yy   = String(d.getFullYear()).slice(2);
    return `${day} ${dd}-${mm}-'${yy}`;
  }

  toDate(iso: string): Date {
    return new Date(iso + 'T00:00:00');
  }

  toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
