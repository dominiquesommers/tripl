import {Component, input, output, ElementRef, ViewChild, computed} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { EditableBadge } from '../editable-badge/editable-badge';

@Component({
  selector: 'app-cost-badge',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './cost-badge.html',
  styleUrls: ['./cost-badge.css', '../editable-badge/editable-badge.css'],
})
export class CostBadge extends EditableBadge {
  // ------------------------
  // Inputs
  // ------------------------
  estimatedCost = input.required<number>();
  isPaid = input.required<boolean>();

  actualCost = input<number | null>(null);
  paidDate = input<Date | null>(null);
  note = input<string | null>(null);
  referenceUrl = input<string | null>(null);
  categoryIcon = input<string | null>(null);
  categoryIconColor = input<string>('#f1c40f');

  // ------------------------
  // Outputs
  // ------------------------
  saveEstimated = output<number>();
  saveActual = output<number>();
  togglePaid = output<boolean>();
  openDetails = output<void>();

  // ------------------------
  // ViewChild references
  // ------------------------
  @ViewChild('estimateInput') estimateInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('actualInput') actualInputRef!: ElementRef<HTMLInputElement>;

  costStatus = computed(() => {
    const actual = this.actualCost();
    const paid = this.isPaid();

    if (actual === null && !paid) return 'default';
    if (actual !== null && !paid) return 'pending';
    if (actual !== null && paid) return 'done';
    if (actual === null && paid) return 'error';

    return 'default';
  });

  // ------------------------
  // Handlers
  // ------------------------

  onTogglePaid() {
    this.togglePaid.emit(!this.isPaid());
  }

  toggleActualExistence() {
    const currentActual = this.actualCost();
    if (currentActual === null) {
      this.saveActual.emit(this.estimatedCost());
      setTimeout(() => {
        if (this.actualInputRef) {
          const input = this.actualInputRef.nativeElement;
          input.focus();
          input.select();
        }
      }, 0);
    } else {
      console.log('save actual to null.')
      this.saveActual.emit(null as any);
    }
  }

  estimateOpacity() {
    return this.actualCost() != null ? 0.6 : 1;
  }

  // ------------------------
  // Reuse EditableBadge methods
  // ------------------------

  // Save estimated value
  onEstimateBlur() {
    this.inputRef = this.estimateInputRef;
    super.onBlur();
    this.saveEstimated.emit(this.estimateInputRef.nativeElement.valueAsNumber);
  }

  // Save actual value
  onActualBlur() {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    super.onBlur();
    this.saveActual.emit(this.actualInputRef.nativeElement.valueAsNumber);
  }

  // Adjust estimated
  adjustEstimate(direction: number) {
    this.inputRef = this.estimateInputRef;
    super.adjust(direction);
    this.saveEstimated.emit(this.estimateInputRef.nativeElement.valueAsNumber);
  }

  // Adjust actual
  adjustActual(direction: number) {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    super.adjust(direction);
    this.saveActual.emit(this.actualInputRef.nativeElement.valueAsNumber);
  }

  // KeyDown / Paste wrappers
  onEstimateKeyDown(event: KeyboardEvent) {
    this.inputRef = this.estimateInputRef;
    super.onKeyDown(event);
  }

  onActualKeyDown(event: KeyboardEvent) {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    super.onKeyDown(event);
  }

  handleEstimatePaste(event: ClipboardEvent) {
    this.inputRef = this.estimateInputRef;
    super.handlePaste(event);
  }

  handleActualPaste(event: ClipboardEvent) {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    super.handlePaste(event);
  }
}
