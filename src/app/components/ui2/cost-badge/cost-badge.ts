import { Component, input, output, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { CostPopup } from '../cost-popup/cost-popup';
import { Expense, NewExpense, UpdateExpense } from '../../../models/expense';
import { AggregateCostBreakdown } from '../cost/cost';

@Component({
  selector: 'app-cost-badge',
  standalone: true,
  imports: [OverlayModule, LucideAngularModule, CostPopup],
  templateUrl: './cost-badge.html',
  styleUrl: './cost-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostBadge {
  // ─── Inputs ───────────────────────────────────────────────
  readonly       = input<boolean>(false);
  actualReadonly = input<boolean>(false);
  aggregate      = input<boolean>(false);
  estimatedCost  = input<number | null>(0);
  actualCost     = input<number | null>(null);
  expenses       = input<Expense[] | null>(null);
  breakdown      = input<AggregateCostBreakdown[] | null>(null);
  decimalPlaces  = input<number>(0);
  step           = input<number>(1);
  min            = input<number>(0);
  actualCostMode = input<'manual' | 'derived'>('manual');
  // aggregates only: fraction (0–1) of the displayed value that comes from
  // actualized entries vs. still-budgeted ones — tells you how much of the
  // diff could still move as more entries get an actual cost. Leave unset
  // for a single entry — it falls back to the plain has-actual-or-not case.
  actualRatio    = input<number | null>(null);

  // ─── Outputs ──────────────────────────────────────────────
  saveEstimated = output<number | null>();
  saveActual    = output<number | null>();
  removeActual  = output<void>();
  addExpense    = output<NewExpense>();
  updateExpense = output<UpdateExpense & { id: string }>();
  deleteExpense = output<string>();
  fetchExpenses = output<void>();
  toggleActualCostMode = output<'manual' | 'derived'>();

  // ─── Overlay state ────────────────────────────────────────
  isOpen = signal(false);

  overlayPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  // ─── Derived display ──────────────────────────────────────
  hasActual = computed(() => this.actualCost() !== null);

  paidAmount = computed(() => {
    const expenses = this.expenses();
    if (!expenses) return 0;
    return expenses.reduce((sum, e) => sum + e.amount(), 0);
  });

  isOverpaid = computed(() => {
    const total = this.actualCost();
    if (total == null) return false;
    const paid = Math.round(this.paidAmount() * 100) / 100;
    const rounded = Math.round(total * 100) / 100;
    return paid > rounded;
  });

  isUnderpaid = computed(() => {
    const total = this.actualCost();
    if (total == null) return false;
    const paid = Math.round(this.paidAmount() * 100) / 100;
    const rounded = Math.round(total * 100) / 100;
    return paid < rounded;
  });

  // anomaly: expenses were recorded but no actual cost has been set to match them against
  hasPayments = computed(() => this.paidAmount() > 0);

  // 0 = fully provisional (dotted), 1 = fully settled (solid), in between = mixed.
  underlineRatio = computed(() => this.actualRatio() ?? (this.hasActual() ? 1 : 0));

  displayValue = computed(() => {
    const value = this.hasActual() ? this.actualCost()! : this.estimatedCost();
    return this.formatValue(value);
  });

  diff = computed(() => {
    if (!this.hasActual() || this.estimatedCost() === null) return null;
    const raw = this.actualCost()! - this.estimatedCost()!;
    return Math.round(raw * 100) / 100;
  });

  isOver  = computed(() => (this.diff() ?? 0) > 0);
  isUnder = computed(() => (this.diff() ?? 0) < 0);

  diffDisplay = computed(() => {
    const d = this.diff();
    if (d === null) return '';
    return this.formatValue(Math.abs(d));
  });

  // settlement status — independent of the provisional/diff styling,
  // surfaced only as a small dot (error/overpaid), see cost-badge.html
  costStatus = computed(() => {
    if (this.readonly()) return 'readonly';
    const actual = this.actualCost();
    if (actual !== null && this.isOverpaid()) return 'overpaid';
    if (actual !== null && this.isUnderpaid()) return 'underpaid';
    if (actual === null && this.hasPayments()) return 'error';
    return 'default';
  });

  private formatValue(value: number | null): string {
    if (value === null) return '';
    if (value === 0) return 'Free';
    const formatted = this.decimalPlaces() > 0
      ? value.toFixed(this.decimalPlaces())
      : Math.round(value).toString();
    return '€ ' + formatted.replace('.', ',');
  }

  // ─── Overlay handlers ─────────────────────────────────────
  toggle = () => {
    if (this.readonly()) return;
    if (!this.isOpen()) this.fetchExpenses.emit();
    this.isOpen.set(!this.isOpen());
  };

  close = () => this.isOpen.set(false);
}
