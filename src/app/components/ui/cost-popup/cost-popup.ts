import {Component, computed, input, output, signal} from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import {Expense, NewExpense, UpdateExpense} from '../../../models/expense';

@Component({
  selector: 'app-cost-popup',
  standalone: true,
  imports: [LucideAngularModule, DatePipe],
  templateUrl: './cost-popup.html',
  styleUrls: ['./cost-popup.css'],
})
export class CostPopup {

  // ─── Inputs ───────────────────────────────────────────────
  expenses = input.required<Expense[]>();

  // ─── Outputs ──────────────────────────────────────────────
  addExpense    = output<NewExpense>();
  updateExpense = output<UpdateExpense & { id: string }>();
  deleteExpense = output<string>();
  close         = output<void>();

  // ─── Add form state ───────────────────────────────────────
  isAdding    = signal(false);
  newDate     = signal(this.todayISO());
  newAmount   = signal<number | null>(null);
  newDetails  = signal<string | null>(null);

  // ─── Edit state ───────────────────────────────────────────
  editingId   = signal<string | null>(null);
  editDate    = signal('');
  editAmount  = signal<number>(0);
  editDetails = signal<string | null>(null);

  expensesOrdered = computed(() =>
    [...this.expenses()].sort((a, b) =>
      a.date().localeCompare(b.date())
    )
  );

  // ─── Helpers ──────────────────────────────────────────────
  todayISO(): string {
    return new Date().toISOString().split('T')[0];
  }

  startEdit(exp: Expense) {
    this.editingId.set(exp.id);
    this.editDate.set(exp.date());
    this.editAmount.set(exp.amount());
    this.editDetails.set(exp.details() ?? null);
  }

  confirmEdit(exp: Expense) {
    const amount = this.editAmount();
    if (!amount) return;
    this.updateExpense.emit({
      id: exp.id,
      amount,
      date: this.editDate(),
      details: this.editDetails(),
    });
    this.editingId.set(null);
  }

  confirmAdd() {
    const amount = this.newAmount();
    if (!amount) return;
    this.addExpense.emit({
      amount,
      date: this.newDate(),
      details: this.newDetails(),
    } as NewExpense);
    this.isAdding.set(false);
    this.newAmount.set(null);
    this.newDetails.set(null);
    this.newDate.set(this.todayISO());
  }

  onDelete(exp: Expense, event: MouseEvent) {
    event.stopPropagation();
    this.deleteExpense.emit(exp.id);
  }
}
