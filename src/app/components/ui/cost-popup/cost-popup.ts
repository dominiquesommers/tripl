import {Component, computed, input, output, Signal, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Expense, NewExpense, UpdateExpense } from '../../../models/expense';
import { EditableBadge } from '../editable-badge/editable-badge';
import { DatePicker } from '../date-picker/date-picker';

@Component({
  selector: 'app-cost-popup',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, EditableBadge, DatePicker],
  templateUrl: './cost-popup.html',
  styleUrls: ['./cost-popup.css'],
})
export class CostPopup {

  // ─── Inputs ───────────────────────────────────────────────
  expenses = input.required<Signal<Expense[]>>();
  actualCost = input.required<Signal<number | null>>();

  // ─── Outputs ──────────────────────────────────────────────
  addExpense    = output<NewExpense>();
  updateExpense = output<UpdateExpense & { id: string }>();
  deleteExpense = output<string>();
  close         = output<void>();

  // ─── Edit state ───────────────────────────────────────────
  editingId = signal<string | null>(null);

  // ─── Ordering: newest first ───────────────────────────────
  expensesOrdered = computed(() =>
    [...this.expenses()()].sort((a, b) => b.date().localeCompare(a.date()))
  );

  // expensesOrdered = computed(() => {
  //     console.log(this.expenses());
  //     return [...this.expenses()].sort((a, b) => b.date().localeCompare(a.date()))
  //   }
  // );

  paidAmount = computed(() =>
    this.expensesOrdered().reduce((sum, e) => sum + e.amount(), 0)
  );

  remainingCost = computed(() => {
    const total = this.actualCost()();
    if (total == null) return null;
    return total - this.paidAmount();
  });

  // ─── Quick add: pay in full ────────────────────────────────
  addFullPayment() {
    const remaining = this.remainingCost();
    if (remaining == null || remaining <= 0) return;
    this.addExpense.emit({
      amount: remaining,
      date: this.todayISO(),
      details: null,
    } as NewExpense);
  }

  // ─── Immediate add ────────────────────────────────────────
  addNew() {
    this.addExpense.emit({
      amount:  0,
      date:    this.todayISO(),
      details: null,
    } as NewExpense);
  }

  // ─── Blur-to-save updates ─────────────────────────────────
  updateDate(exp: Expense, date: Date | null) {
    if (!date) return;
    this.updateExpense.emit({
      id:   exp.id,
      date: this.toISODate(date),
    });
  }

  updateAmount(exp: Expense, amount: number) {
    this.updateExpense.emit({ id: exp.id, amount });
  }

  updateDetails(exp: Expense, details: string) {
    this.updateExpense.emit({
      id:      exp.id,
      details: details || null,
    });
  }

  onDelete(exp: Expense, event: MouseEvent) {
    event.stopPropagation();
    this.deleteExpense.emit(exp.id);
  }

  // ─── Date helpers ─────────────────────────────────────────
  todayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  toDate(iso: string | null): Date | null {
    if (!iso) return null;
    return new Date(iso + 'T00:00:00Z');
  }

  toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
