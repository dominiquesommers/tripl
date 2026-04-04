import {
  Component, input, output, computed,
  ViewChild, ElementRef,
  ChangeDetectionStrategy, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule, MatDatepicker, MatDateRangePicker } from '@angular/material/datepicker';
import { MatTimepickerModule, MatTimepickerSelected } from '@angular/material/timepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatNativeDateModule } from '@angular/material/core';
import { LucideAngularModule } from 'lucide-angular';
import { MAT_DATE_LOCALE } from '@angular/material/core';

export type DatePickerMode = 'date' | 'date-range' | 'datetime-range';


@Component({
  selector: 'app-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTimepickerModule,
    MatInputModule,
    MatFormFieldModule,
    LucideAngularModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'nl-NL' }
  ],
  templateUrl: './date-picker.html',
  styleUrls: ['./date-picker.css'],
})
export class DatePicker {

  // ─── Mode ─────────────────────────────────────────────────
  mode          = input<DatePickerMode>('date');
  disabled      = input<boolean>(false);
  displayFormat = input<'short' | 'compact'>('short');

  // ─── Single date ──────────────────────────────────────────
  value       = input<Date | null>(null);
  valueChange = output<Date | null>();

  // ─── Date range ───────────────────────────────────────────
  start       = input<Date | null>(null);
  end         = input<Date | null>(null);
  startChange = output<Date | null>();
  endChange   = output<Date | null>();

  // ─── Datetime range ───────────────────────────────────────
  departure       = input<Date | null>(null);
  arrival         = input<Date | null>(null);
  departureChange = output<Date | null>();
  arrivalChange   = output<Date | null>();

  // ─── FormControls for timepickers ─────────────────────────
  depTimeControl = new FormControl<Date | null>(null);
  arrTimeControl = new FormControl<Date | null>(null);

  // ─── Refs ─────────────────────────────────────────────────
  @ViewChild('singlePicker') singlePicker!: MatDatepicker<Date>;
  @ViewChild('rangePicker')  rangePicker!:  MatDateRangePicker<Date>;
  @ViewChild('triggerEl')    triggerEl!:    ElementRef;

  // ─── Display label ────────────────────────────────────────

  hasValue = computed(() => this.displayLabel() !== null);

  // ─── Format helpers ───────────────────────────────────────

  formatDate(date: Date): string {
    if (this.displayFormat() === 'compact') {
      const day = date.toLocaleDateString('nl-NL', { weekday: 'short' });
      const dd  = String(date.getDate()).padStart(2, '0');
      const mm  = String(date.getMonth() + 1).padStart(2, '0');
      const yy  = String(date.getFullYear()).slice(2);
      return `${day} ${dd}-${mm}-'${yy}`;
    }
    return date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatDatetime(date: Date): string {
    return `${this.formatDate(date)} ${this.toTimeStr(date)}`;
  }

  toTimeStr(date: Date | null): string {
    if (!date) return '00:00';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // ─── Open ─────────────────────────────────────────────────

  open() {
    if (this.disabled()) return;
    if (this.mode() === 'date') this.singlePicker.open();
    else {
      console.log(this.rangePicker);
      this.rangePicker.open();
    }
  }

  // ─── Single date ──────────────────────────────────────────

  onSingleChange(date: Date | null) {
    this.valueChange.emit(date);
  }

  // ─── Range / datetime-range ───────────────────────────────

  onRangeStartChange(date: Date | null) {
    if (this.mode() === 'date-range') {
      this.startChange.emit(date);
    } else {
      if (date && this.departure()) {
        date.setHours(this.departure()!.getHours(), this.departure()!.getMinutes(), 0, 0);
      }
      this.departureChange.emit(date);
    }
  }

  onRangeEndChange(date: Date | null) {
    if (this.mode() === 'date-range') {
      this.endChange.emit(date);
    } else {
      if (date) {
        const refTime = this.arrival() || this.departure() || new Date();
        date.setHours(refTime.getHours(), refTime.getMinutes(), 0, 0);
        const dep = this.departure();
        if (dep && this.isSameDay(dep, date) && date.getTime() < dep.getTime()) {
          date.setHours(dep.getHours(), dep.getMinutes(), 0, 0);
        }
      }
      this.arrivalChange.emit(date);
    }
  }

  onPickerClosed() {
    console.log('onPickerClosed');
    setTimeout(() => {
      const s = (this.mode() === 'date-range') ? this.start() : this.departure();
      const e = (this.mode() === 'date-range') ? this.end() : this.arrival();
      // If we have a start but the end was never picked (clicked outside)
      if (s && !e) {
        console.log('fix!')
        if (this.mode() === 'date-range') {
          this.endChange.emit(new Date(s));
        } else if (this.mode() === 'datetime-range') {
          this.arrivalChange.emit(new Date(s));
        }
      }
    }, 100);
  }

  displayLabel = computed((): string | null => {
    const m = this.mode();

    if (m === 'date') {
      const v = this.value();
      return v ? this.formatDate(v) : null;
    }

    if (m === 'date-range') {
      const s = this.start(), e = this.end();
      if (!s && !e) return null;
      if (s && !e) return this.formatDate(s) + ' –';
      // Logic: If same day, just show one date
      if (this.isSameDay(s, e)) return this.formatDate(s!);
      return `${this.formatDate(s!)} – ${this.formatDate(e!)}`;
    }

    if (m === 'datetime-range') {
      const dep = this.departure(), arr = this.arrival();
      if (!dep || !arr) return null;

      console.log(dep, arr);

      // Logic: If same day, format as "Date Time - Time"
      if (this.isSameDay(dep, arr)) {
        return `${this.formatDate(dep!)} ${this.toTimeStr(dep)} - ${this.toTimeStr(arr)}`;
      }

      return `${this.formatDatetime(dep!)} - ${this.formatDatetime(arr!)}`;
    }
    return null;
  });

  // Update the HH:mm handler to stop propagation
  updateTimePart(event: Event, part: 'h' | 'm', value: string, type: 'departure' | 'arrival') {
    event.stopPropagation();

    const dep = this.departure();
    const arr = this.arrival();
    const current = type === 'departure' ? this.departure() : this.arrival();
    if (!current) return;

    const updated = new Date(current);
    let num = parseInt(value, 10);

    if (part === 'h') {
      num = Math.max(0, Math.min(23, isNaN(num) ? 0 : num));
      updated.setHours(num);
    } else {
      num = Math.max(0, Math.min(59, isNaN(num) ? 0 : num));
      updated.setMinutes(num);
    }
    updated.setSeconds(0, 0);

    if (this.isSameDay(dep, arr)) {
      // 1. If editing Arrival and it moves BEFORE Departure -> Push Departure back
      if (type === 'arrival' && dep && updated.getTime() < dep.getTime()) {
        this.departureChange.emit(new Date(updated));
      }

      // 2. If editing Departure and it moves AFTER Arrival -> Push Arrival forward
      if (type === 'departure' && arr && updated.getTime() > arr.getTime()) {
        this.arrivalChange.emit(new Date(updated));
      }
    }

    (type === 'departure') ? this.departureChange.emit(updated) : this.arrivalChange.emit(updated);
  }

  // Helper for the auto-prefixing logic in the UI
  formatPart(num: number | undefined): string {
    if (num === undefined) return '00';
    return String(num).padStart(2, '0');
  }

  isSameDay(d1: Date | null, d2: Date | null): boolean {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }
}
