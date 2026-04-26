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
  readonly = input<boolean>(false);

  draft = signal<string>('');

  width = computed(() => {
    const str = this.draft() || String(Math.round(this.value() ?? 0));
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
    const newValue = Math.max(this.min(), value + (direction * this.step()));
    this.save.emit(newValue);
  }

  onBlur() {
    const rawValue = this.inputRef.nativeElement.value;
    const sanitizedValue = (rawValue === '' || isNaN(parseInt(rawValue)))
      ? this.min()
      : Math.max(this.min(), Math.floor(Number(rawValue)));
    this.inputRef.nativeElement.value = sanitizedValue.toString();
    this.draft.set('');
    this.save.emit(sanitizedValue);
    // const val = parseInt(this.inputRef.nativeElement.value, 10);
    // this.save.emit(isNaN(val) ? this.min() : val);
  }

  onKeyDown(event: KeyboardEvent) {
    // Prevent non-numeric characters (except backspace, delete, arrows)
    if (['e', 'E', '+', '-', '.'].includes(event.key)) {
      event.preventDefault();
    }
    if (event.key === 'Enter') {
      this.inputRef.nativeElement.blur();
    }
  }

  handlePaste(event: ClipboardEvent) {
    const data = event.clipboardData?.getData('text');
    if (data && !/^\d+$/.test(data)) {
      event.preventDefault();
      const sanitizedValue = (data === '' || isNaN(parseInt(data)))
        ? 0 : Math.max(0, Math.floor(Number(data)));
      document.execCommand('insertText', false, sanitizedValue.toString());
    }
  }
}
