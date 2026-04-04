import {
  Component, input, output, ElementRef, ViewChild, computed, signal
} from '@angular/core';
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

  // ─── Inputs ───────────────────────────────────────────────
  estimatedCost = input.required<number>();
  isPaid        = input.required<boolean>();
  actualCost    = input<number | null>(null);
  hasExpenses   = input<boolean>(false);  // drives the info icon visibility
  readonly = input<boolean>(false);
  actualReadonly = input<boolean>(false);

  // ─── Outputs ──────────────────────────────────────────────
  saveEstimated = output<number>();
  saveActual    = output<number | null>();
  removeActual    = output<void>();
  // togglePaid    = output<boolean>();
  openDetails   = output<void>();

  // ─── Draft signals for dynamic width ──────────────────────
  estimateDraft = signal<string>('');
  actualDraft   = signal<string>('');

  // ─── ViewChild refs ───────────────────────────────────────
  @ViewChild('estimateInput') estimateInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('actualInput')   actualInputRef!:   ElementRef<HTMLInputElement>;

  // ─── Computed ─────────────────────────────────────────────
  costStatus = computed(() => {
    if (this.readonly()) return 'readonly';
    if (this.actualReadonly()) return 'default';
    const actual = this.actualCost();
    const paid   = this.isPaid();
    if (actual === null && !paid) return 'default';
    if (actual !== null && !paid) return 'pending';
    if (actual !== null &&  paid) return 'done';
    if (actual === null &&  paid) return 'error';
    return 'default';
  });

  estimateOpacity = computed(() => this.actualCost() != null ? 0.6 : 1);

  estimateWidth = computed(() => {
    const str = this.estimateDraft() || String(Math.round(this.estimatedCost()));
    return Math.max(str.length, 1);
  });

  actualWidth = computed(() => {
    const val = this.actualCost();
    const str = this.actualDraft() || (val !== null ? String(Math.round(val)) : '');
    return Math.max(str.length, 1);
  });

  // ─── Handlers ─────────────────────────────────────────────

  toggleActualExistence() {
    const current = this.actualCost();
    console.log('toggleActualExistence', current);
    if (current === null) {
      this.saveActual.emit(this.estimatedCost());
      setTimeout(() => {
        const input = this.actualInputRef?.nativeElement;
        if (input) { input.focus(); input.select(); }
      }, 0);
    } else {
      console.log('removeActual')
      this.removeActual.emit();
    }
  }

  // ─── EditableBadge overrides ──────────────────────────────
  onEstimateBlur() {
    this.inputRef = this.estimateInputRef;
    super.onBlur();
    this.estimateDraft.set('');
    this.saveEstimated.emit(this.estimateInputRef.nativeElement.valueAsNumber);
  }

  onActualBlur() {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    super.onBlur();
    this.actualDraft.set('');
    this.saveActual.emit(this.actualInputRef.nativeElement.valueAsNumber);
  }

  adjustEstimate(direction: number) {
    this.inputRef = this.estimateInputRef;
    super.adjust(direction);
    this.saveEstimated.emit(this.estimateInputRef.nativeElement.valueAsNumber);
  }

  adjustActual(direction: number) {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    super.adjust(direction);
    this.saveActual.emit(this.actualInputRef.nativeElement.valueAsNumber);
  }

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
