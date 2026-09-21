import { Component, input, output } from '@angular/core';
import { CostBadge } from '../cost-badge/cost-badge';
import { Expense, NewExpense, UpdateExpense } from '../../../models/expense';


export interface AggregateCostBreakdown {
  icon?: string;
  iconColor?: string;
  label: string;
  value: number;
}


@Component({
  selector: 'app-cost',
  standalone: true,
  imports: [CostBadge],
  templateUrl: './cost.html',
  styleUrls: ['./cost.css'],
})
export class Cost {
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
  actualRatio    = input<number | null>(null);

  // ─── Outputs — passed straight through to CostBadge ────────
  saveEstimated = output<number | null>();
  saveActual    = output<number | null>();
  removeActual  = output<void>();
  addExpense    = output<NewExpense>();
  updateExpense = output<UpdateExpense & { id: string }>();
  deleteExpense = output<string>();
  fetchExpenses = output<void>();
  toggleActualCostMode = output<'manual' | 'derived'>();
}
