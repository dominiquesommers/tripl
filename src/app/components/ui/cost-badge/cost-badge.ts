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
    const str = this.estimateDraft() || this.formatValue(this.estimatedCost());
    return Math.max(str.length, 1);
  });

  actualWidth = computed(() => {
    const val = this.actualCost();
    const str = this.actualDraft() || (val !== null ? this.formatValue(val) : '');
    return Math.max(str.length, 1);
  });

  // ─── Focus Wrappers for Auto-Selection ────────────────────
  onEstimateFocus() {
    setTimeout(() => this.estimateInputRef?.nativeElement?.select());
  }

  onActualFocus() {
    setTimeout(() => this.actualInputRef?.nativeElement?.select());
  }

  // ─── Clean Input Normalization ────────────────────────────
  onEstimateInput(event: Event) {
    let value = (event.target as HTMLInputElement).value.replace(/[^0-9.,]/g, '');
    this.estimateInputRef.nativeElement.value = value;
    this.estimateDraft.set(value);
  }

  onActualInput(event: Event) {
    let value = (event.target as HTMLInputElement).value.replace(/[^0-9.,]/g, '');
    this.actualInputRef.nativeElement.value = value;
    this.actualDraft.set(value);
  }

  // ─── Handlers ─────────────────────────────────────────────

  toggleActualExistence() {
    const current = this.actualCost();
    if (current === null) {
      this.saveActual.emit(this.sanitizeValue(this.estimatedCost()));
      setTimeout(() => {
        const input = this.actualInputRef?.nativeElement;
        if (input) { input.focus(); input.select(); }
      }, 0);
    } else {
      this.removeActual.emit();
    }
  }

  // ─── EditableBadge overrides ──────────────────────────────
  onEstimateBlur() {
    this.inputRef = this.estimateInputRef;
    const sanitized = this.parseInputValue(this.estimateInputRef.nativeElement.value);
    super.onBlur();
    this.estimateDraft.set('');
    this.saveEstimated.emit(sanitized);
    // this.saveEstimated.emit(this.estimateInputRef.nativeElement.valueAsNumber);
  }

  onActualBlur() {
    if (!this.actualInputRef) return;
    this.inputRef = this.actualInputRef;
    const sanitized = this.parseInputValue(this.actualInputRef.nativeElement.value);
    super.onBlur();
    this.actualDraft.set('');
    this.saveActual.emit(sanitized);
    // this.saveActual.emit(this.actualInputRef.nativeElement.valueAsNumber);
  }

  adjustEstimate(direction: number) {
    const newValue = this.sanitizeValue(this.estimatedCost() + (direction * this.step()));
    this.estimateInputRef.nativeElement.value = this.formatValue(newValue);
    this.saveEstimated.emit(newValue);
  }

  adjustActual(direction: number) {
    if (!this.actualInputRef) return;
    const current = this.actualCost();
    if (current === null) return;
    const newValue = this.sanitizeValue(current + (direction * this.step()));
    this.actualInputRef.nativeElement.value = this.formatValue(newValue);
    this.saveActual.emit(newValue);
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
