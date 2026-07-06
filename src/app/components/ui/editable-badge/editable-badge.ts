import {Component, input, output, ElementRef, ViewChild, computed, signal} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-editable-badge',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './editable-badge.html',
  styleUrl: './editable-badge.css'
})
export class EditableBadge {
  // Inputs
  value = input<number | null>(null);
  // isLargeValue = input<boolean>(false);
  iconName = input<string | null>(null); // Default icon
  iconColor = input<string>('#bdbdbd');
  prefix = input<string>('');        // e.g., '€'
  postfix = input<string>('');        // e.g., 'h/km'
  step = input<number>(1);           // Customizable step
  min = input<number>(0);
  decimalPlaces = input<number>(0);
  readonly = input<boolean>(false);

  draft = signal<string>('');

  width = computed(() => {
    const str = this.draft() || this.formatValue(this.value() ?? 0);
    return Math.max(str.length, 1) + 1;
  });

  // Outputs
  save = output<number>();           // For the blur/save callback
  iconClick = output<void>();
  hasIconAction = input<boolean>(false);

  @ViewChild('numInput') inputRef!: ElementRef<HTMLInputElement>;

  adjust(direction: number) {
    const value = this.value();
    if (value == null) return;
    const newValue = this.sanitizeValue(value + (direction * this.step()));
    if (this.inputRef?.nativeElement) {
      this.inputRef.nativeElement.value = this.formatValue(newValue);
    }
    this.save.emit(newValue);
  }

  onFocus() {
    // Select all text on focus. setTimeout avoids native browser focus race conditions.
    setTimeout(() => {
      this.inputRef?.nativeElement?.select();
    });
  }

  onBlur() {
    const rawValue = this.inputRef.nativeElement.value;
    const sanitizedValue = this.parseInputValue(rawValue);
    this.inputRef.nativeElement.value = this.formatValue(sanitizedValue);
    this.draft.set('');
    this.save.emit(sanitizedValue);
  }

  onKeyDown(event: KeyboardEvent) {
    const input = this.inputRef.nativeElement;

    // 1. Allow control keys (Backspace, Delete, Arrow keys, Tab, Escape, etc.)
    if (event.key.length > 1) {
      if (event.key === 'Enter') {
        input.blur();
      }
      return; // Let system shortcuts and navigation pass through
    }

    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    const isReplacingAll = selectionStart === 0 && selectionEnd === input.value.length;

    if (!/^\d$/.test(event.key) && !['.', ','].includes(event.key)) {
      event.preventDefault();
      return;
    }

    if (['.', ','].includes(event.key)) {
      const hasSeparator = input.value.includes(',') || input.value.includes('.');
      const sepIndex = input.value.indexOf(',') !== -1 ? input.value.indexOf(',') : input.value.indexOf('.');
      const separatorIsSelected = hasSeparator && sepIndex >= selectionStart && sepIndex < selectionEnd;

      if (this.normalizedDecimalPlaces() === 0 || (hasSeparator && !separatorIsSelected)) {
        event.preventDefault();
      }
      return;
    }

    if (/^\d$/.test(event.key) && this.normalizedDecimalPlaces() > 0 && !isReplacingAll) {      const input = this.inputRef.nativeElement;
      const sepIndex = input.value.indexOf(',') !== -1 ? input.value.indexOf(',') : input.value.indexOf('.');
      const replacingSelection = selectionEnd > selectionStart;
      if (
        sepIndex >= 0 &&
        selectionStart > sepIndex &&
        input.value.slice(sepIndex + 1).length >= this.normalizedDecimalPlaces() &&
        !replacingSelection
      ) {
        event.preventDefault();
      }
    }

    if (event.key === 'Enter') {
      input.blur();
    }
  }

  // Fallback cleanup for mobile input behaviors
  onInput(event: Event) {
    if (this.readonly()) return;
    let targetValue = (event.target as HTMLInputElement).value;

    // Normalize mobile commas to dots
    targetValue = targetValue.replace(/[^0-9.,]/g, '');
    // targetValue = targetValue.replace(',', '.');
    this.draft.set(targetValue);
  }

  handlePaste(event: ClipboardEvent) {
    const data = event.clipboardData?.getData('text');
    if (!data) return;

    const normalized = data.trim().replace(',', '.');
    const validPattern = this.normalizedDecimalPlaces() > 0
      ? new RegExp(`^\\d+(\\.\\d{0,${this.normalizedDecimalPlaces()}})?$`)
      : /^\d+$/;
    if (!validPattern.test(normalized) || normalized !== data.trim()) {
      event.preventDefault();
      document.execCommand('insertText', false, this.formatValue(this.parseInputValue(normalized)));
    }
  }

  protected parseInputValue(rawValue: string) {
    const parsedValue = Number(rawValue.replace(',', '.'));
    return Number.isFinite(parsedValue) ? this.sanitizeValue(parsedValue) : this.min();
  }

  protected sanitizeValue(value: number) {
    const minValue = Math.max(this.min(), value);
    const decimalPlaces = this.normalizedDecimalPlaces();
    if (decimalPlaces === 0) return Math.floor(minValue);

    const factor = 10 ** decimalPlaces;
    return Math.round(minValue * factor) / factor;
  }

  formatValue(value: number) {
    const decimalPlaces = this.normalizedDecimalPlaces();
    const formatted = decimalPlaces === 0 ? String(Math.floor(value)) : value.toFixed(decimalPlaces);
    // Replace the dot with a comma for display purposes
    return formatted.replace('.', ',');
  }

  private normalizedDecimalPlaces() {
    return Math.max(0, Math.floor(this.decimalPlaces()));
  }
}
