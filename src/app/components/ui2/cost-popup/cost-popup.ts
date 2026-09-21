import { Component, input, output, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Expense, NewExpense, UpdateExpense } from '../../../models/expense';
import { DatePicker } from '../../ui/date-picker/date-picker';
import { NotificationService } from '../../../services/notification';
import { UiService } from '../../../services/ui';
import { EditableBadge } from '../editable-badge/editable-badge';
import { RichTextarea } from '../../ui/rich-textarea/rich-textarea';
import { AggregateCostBreakdown } from '../cost/cost';


@Component({
  selector: 'app-cost-popup',
  standalone: true,
  imports: [LucideAngularModule, DatePicker, EditableBadge, RichTextarea],
  templateUrl: './cost-popup.html',
  styleUrl: './cost-popup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostPopup {
  private notificationService = inject(NotificationService);
  private uiService = inject(UiService);

  // ─── Inputs ───────────────────────────────────────────────
  estimatedCost  = input.required<number | null>();
  actualCost     = input<number | null>(null);
  expenses       = input<Expense[] | null>(null);
  breakdown      = input<AggregateCostBreakdown[] | null>(null);
  readonly       = input<boolean>(false);
  actualReadonly = input<boolean>(false);
  aggregate      = input<boolean>(false);
  step           = input<number>(1);
  min            = input<number>(0);
  decimalPlaces  = input<number>(2);
  // 'manual': actual is a directly-entered value, expenses are payments toward it
  // 'derived': actual is locked to always equal the sum of expenses
  actualCostMode = input<'manual' | 'derived'>('manual');

  // ─── Outputs ──────────────────────────────────────────────
  saveEstimated = output<number | null>();
  saveActual    = output<number | null>();
  removeActual  = output<void>();
  addExpense    = output<NewExpense>();
  updateExpense = output<UpdateExpense & { id: string }>();
  deleteExpense = output<string>();
  close         = output<void>();
  toggleActualCostMode = output<'manual' | 'derived'>();

  isDerived = computed(() => this.actualCostMode() === 'derived');

  expensesOrdered = computed(() => {
    if (!this.expenses()) return [];
    return [...this.expenses()!].sort((a, b) => b.date().localeCompare(a.date()))
  });

  paidAmount = computed(() =>
    this.expensesOrdered().reduce((sum, e) => sum + e.amount(), 0)
  );

  // what the top row shows: computed sum once locked to derived, else the manual actualCost
  displayedTotal = computed(() =>
    this.isDerived() ? this.paidAmount() : this.actualCost()
  );

  isOverpaid = computed(() => {
    const total = this.actualCost();
    if (total == null) return false;
    const paid = Math.round(this.paidAmount() * 100) / 100;
    const rounded = Math.round(total * 100) / 100;
    return paid > rounded;
  });

  // positive = still owed, negative = overpaid, null = no total to compare against yet
  remaining = computed(() => {
    const total = this.displayedTotal();
    if (total == null) return null;
    return Math.round((total - this.paidAmount()) * 100) / 100;
  });

  showRemainingRow = computed(() => {
    if (this.aggregate()) return false;
    const r = this.remaining();
    return r !== null && r !== 0;
  });

  isOverspend = computed(() => (this.remaining() ?? 0) < 0);
  remainingAbsDisplay = computed(() => this.formatMoney(Math.abs(this.remaining() ?? 0)));

  // ─── Mode toggle ──────────────────────────────────────────
  toggleMode() {
    if (this.actualReadonly()) return;
    const next: 'manual' | 'derived' = this.isDerived() ? 'manual' : 'derived';
    // locking: sync actual to the current paid total right away rather than
    // waiting on a round trip, so the badge doesn't flash a stale diff
    if (next === 'derived') this.saveActual.emit(this.paidAmount());
    this.toggleActualCostMode.emit(next);
  }

  // ─── Actual field (bare input + stepper, no pill) ──────────
  actualDisplayValue = computed(() => {
    const v = this.actualCost();
    return v === null ? '' : this.formatMoney(v);
  });

  onActualFocus(event: FocusEvent) {
    const el = event.target as HTMLInputElement;
    setTimeout(() => el.select());
  }

  onActualKeyDown(event: KeyboardEvent) {
    if (event.key.length > 1) {
      if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
      return;
    }
    if (!/^\d$/.test(event.key) && !['.', ','].includes(event.key)) {
      event.preventDefault();
    }
  }

  onActualPaste(event: ClipboardEvent) {
    const data = event.clipboardData?.getData('text')?.trim() ?? '';
    const normalized = data.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      event.preventDefault();
    }
  }

  // empty blur = clear (with confirm if expenses are attached); otherwise save
  onActualBlur(event: FocusEvent) {
    if (this.actualReadonly() || this.isDerived()) return;
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();

    console.log(raw);

    if (raw === '') {
      this.clearActual();
      return;
    }

    const value = this.parseMoney(raw);
    input.value = this.formatMoney(value);
    this.saveActual.emit(value);
  }

  adjustActual(direction: number) {
    if (this.actualReadonly() || this.isDerived()) return;
    const current = this.actualCost() ?? this.estimatedCost()!;
    this.saveActual.emit(this.roundToStep(current + direction * this.step()));
  }

  // ─── Mobile drag-to-adjust ("rotating roll") ───────────────
  // Opinion: nice for quick nudges on mobile, but keep the pixels-per-step
  // threshold generous (24px used here) so it doesn't fight the popup's own
  // scroll/dismiss gestures — worth a shared directive if you like it enough
  // to reuse across EditableBadge too, rather than duplicating per-widget.
  private dragActive = false;
  private dragStartY = 0;
  private dragStartValue = 0;
  private readonly pxPerStep = 24;

  onActualPointerDown(event: PointerEvent) {
    if (!this.uiService.isMobile() || this.actualReadonly() || this.isDerived()) return;
    this.dragActive = true;
    this.dragStartY = event.clientY;
    this.dragStartValue = this.actualCost() ?? this.estimatedCost()!;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  onActualPointerMove(event: PointerEvent) {
    if (!this.dragActive) return;
    const deltaY = this.dragStartY - event.clientY; // dragging up increases
    const steps = Math.trunc(deltaY / this.pxPerStep);
    const next = this.roundToStep(this.dragStartValue + steps * this.step());
    if (next !== this.actualCost()) this.saveActual.emit(next);
  }

  onActualPointerUp() {
    this.dragActive = false;
  }

  // clears actual cost; if expenses are attached, confirms first since they
  // no longer make sense once there's no actual cost for them to add up to
  private clearActual() {
    const count = this.expensesOrdered().length;
    if (count === 0) {
      this.removeActual.emit();
      return;
    }

    this.notificationService.confirmModal(
      {
        title: 'Remove actual cost',
        message: `This will also delete ${count} linked expense${count > 1 ? 's' : ''}.`,
        confirmLabel: 'Remove',
        isDanger: true,
      },
      () => {
        this.expensesOrdered().forEach(e => this.deleteExpense.emit(e.id));
        this.removeActual.emit();
      }
    );
  }

  // ─── Expenses ─────────────────────────────────────────────
  addFullPayment() {
    const remaining = this.remaining();
    if (remaining === null || remaining <= 0) return;
    this.createExpense(remaining);
  }

  addNew() {
    this.createExpense(0);
  }

  private createExpense(amount: number) {
    this.addExpense.emit({
      amount,
      date: this.todayISO(),
      details: null,
    } as NewExpense);
  }

  onDeleteExpense(expense: Expense) {
    this.deleteExpense.emit(expense.id);
  }

  updateExpenseAmount(expense: Expense, amount: number | null) {
    console.log(amount);
    if (!amount) {
      console.log('confirm delete expense', expense);
      this.notificationService.confirmModal(
        {
          title: 'Remove payment',
          message: ``,
          confirmLabel: 'Remove',
          isDanger: true,
        },
        () => {
          this.deleteExpense.emit(expense.id);
        }
      );
    } else {
      this.updateExpense.emit({ id: expense.id, amount });
    }
  }

  updateExpenseDate(expense: Expense, date: Date | null) {
    if (!date) return;
    this.updateExpense.emit({ id: expense.id, date: this.toISODate(date) });
  }

  updateExpenseDetails(expense: Expense, value: string) {
    this.updateExpense.emit({ id: expense.id, details: value || null });
  }

  // ─── Formatting / date helpers ──────────────────────────────
  private formatMoney(value: number): string {
    const dp = Math.max(0, Math.floor(this.decimalPlaces()));
    const formatted = dp === 0 ? String(Math.round(value)) : value.toFixed(dp);
    return formatted.replace('.', ',');
  }

  private parseMoney(raw: string): number {
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(this.min(), parsed) : this.min();
  }

  private roundToStep(value: number): number {
    const dp = Math.max(0, Math.floor(this.decimalPlaces()));
    const factor = 10 ** dp;
    return Math.max(this.min(), Math.round(value * factor) / factor);
  }

  todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  toDate(iso: string | null): Date | null {
    if (!iso) return null;
    return new Date(iso + 'T00:00:00Z');
  }

  private toISODate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
