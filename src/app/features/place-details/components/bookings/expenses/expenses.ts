import {Component, inject, input, computed, effect, untracked} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TripService } from '../../../../../services/trip';
import { Place } from '../../../../../models/place';
import { Expense, NewExpense, UpdateExpense } from '../../../../../models/expense';
import {DatePicker} from '../../../../../components/ui/date-picker/date-picker';
import {EditableBadge} from '../../../../../components/ui2/editable-badge/editable-badge';
import {RichTextarea} from '../../../../../components/ui/rich-textarea/rich-textarea';
import { formatDate } from '../../../../../utils/dates';
import { NotificationService } from '../../../../../services/notification';
import {OverlayMenu} from '../../../../../components/ui/overlay-menu/overlay-menu';
import {OverlayMenuAction} from '../../../../../models/overlay-menu';


type ExpenseCategory = 'food' | 'miscellaneous';


@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, EditableBadge, DatePicker, RichTextarea, OverlayMenu],
  templateUrl: './expenses.html',
  styleUrls: ['./expenses.css'],
})
export class Expenses {

  tripService = inject(TripService);
  notificationService = inject(NotificationService);
  place       = input.required<Place>();

  // ── Expenses sorted newest first ──────────────────────────
  expenses = computed(() =>
    [...this.place().foodExpenses(), ...this.place().miscExpenses()]
      .sort((a, b) => b.date().localeCompare(a.date()))
  );

  constructor() {
    effect(() => {
      const place = this.place();
      const needsFetching = this.expenses().length > 0 && this.expenses().some(b => !b.detailsFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchExpenseDetails(place.id, 'place').subscribe()
        });
      }
    });
  }

  readonly addExpenseActions = computed((): OverlayMenuAction[] => {
    const actions: OverlayMenuAction[] = [
      {
        icon: 'utensils',
        label: 'Add food expense',
        action: () => this.addNew('food'),
        className: 'food'
      },
      {
        icon: 'shopping-bag',
        label: 'Add miscellaneous expense',
        action: () => this.addNew('miscellaneous'),
        className: 'miscellaneous'
      },
    ];

    return actions;
  });

  // ── Add expense immediately ───────────────────────────────
  addNew(category: string) {
    const trip = this.tripService.trip();
    if (!trip) return;
    this.tripService.addExpense({
      amount:      0,
      date:        this.toISODate(new Date()),
      category:    category,
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

  updateAmount(expense: Expense, amount: number | null) {
    if (!amount) {
      this.notificationService.confirmModal(
        {
          title: 'Remove expense',
          message: ``,
          confirmLabel: 'Remove',
          isDanger: true,
        },
        () => {
          this.tripService.removeExpense(expense).subscribe();
        }
      );
    } else {
      this.tripService.updateExpense(expense.id, { amount }).subscribe();
    }
  }

  updateDetails(expense: Expense, details: string) {
    this.tripService.updateExpense(expense.id, {
      details: details || null
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

  toDate(iso: string): Date {
    return new Date(iso + 'T00:00:00Z');
  }

  toISODate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
