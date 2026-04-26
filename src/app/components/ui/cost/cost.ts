import {
  Component, input, output, signal, computed,
  ElementRef, HostListener, inject, effect, Injector
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { CostBadge } from '../cost-badge/cost-badge';
import { CostPopup } from '../cost-popup/cost-popup';
import {Expense, IExpense, NewExpense, UpdateExpense} from '../../../models/expense';
import { PopupService } from '../../../services/popup';

@Component({
  selector: 'app-cost',
  standalone: true,
  imports: [LucideAngularModule, CostBadge],
  templateUrl: './cost.html',
  styleUrls: ['./cost.css'],
})
export class Cost {
  private injector = inject(Injector);

  // ─── Inputs ───────────────────────────────────────────────
  estimatedCost = input.required<number>();
  actualTotal   = input<number | null>(null);
  isPaid        = input.required<boolean>();
  expenses      = input.required<Expense[]>();
  iconName      = input<string | null>(null);
  iconColor     = input<string>('#f1c40f');
  step          = input<number>(1);
  min           = input<number>(0);

  private expensesSignal = computed(() => this.expenses());


  // ─── Outputs ──────────────────────────────────────────────
  saveEstimated = output<number>();
  saveActual    = output<number | null>();
  removeActual    = output<void>();
  // togglePaid    = output<boolean>();
  addExpense    = output<NewExpense>();
  updateExpense = output<UpdateExpense & { id: string }>();
  deleteExpense = output<string>();
  fetchExpenses = output<void>();

  // ─── Services ─────────────────────────────────────────────
  private elRef      = inject(ElementRef);
  private popupSvc   = inject(PopupService);

  // ─── Derived ──────────────────────────────────────────────
  paidAmount = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount(), 0)
  );

  hasExpenses = computed(() => this.expenses().length > 0);

  // ─── Outside click ────────────────────────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const insideBadge  = this.elRef.nativeElement.contains(event.target as Node);
    const insidePopup  = !!(event.target as HTMLElement).closest?.('[data-popup]');
    if (!insideBadge && !insidePopup && this.popupSvc.isOpen()) {
      this.popupSvc.close();
    }
  }

  // ─── Popup ────────────────────────────────────────────────
  onOpenDetails() {
    this.fetchExpenses.emit();
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    const ref = this.popupSvc.open(CostPopup, {
      position: { top: rect.bottom + 8, left: rect.left + rect.width / 2 },
      inputs: {
        expenses: this.expenses,
      },
      outputs: {
        addExpense:    (e: NewExpense)                      => this.addExpense.emit(e),
        updateExpense: (e: UpdateExpense & { id: string })  => this.updateExpense.emit(e),
        deleteExpense: (id: string)                         => this.deleteExpense.emit(id),
        close:         ()                                   => this.popupSvc.close(),
      },
    });
  }
}
