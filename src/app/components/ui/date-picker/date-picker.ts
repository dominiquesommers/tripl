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

  // ─── UTC ↔ Material (local) boundary helpers ───────────────
  // Material (MatNativeDateModule) always builds/reads Date objects
  // using LOCAL getters/setters. Our model is UTC-canonical everywhere
  // else. These two helpers are the ONLY place that boundary crossing
  // should happen.

  /** Material gave us a Date (local Y/M/D just picked) → re-anchor to UTC midnight of that same calendar day. */
  private toUTCMidnight(localDate: Date): Date {
    return new Date(Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate()
    ));
  }

  /** Our UTC-canonical Date → a Date Material will display on the correct calendar cell (matches Y/M/D via local getters). */
  private toLocalDisplayDate(utcDate: Date | null): Date | null {
    if (!utcDate) return null;
    return new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate()
    );
  }

  // ─── Format helpers ───────────────────────────────────────

  formatDate(date: Date): string {
    if (this.displayFormat() === 'compact') {
      const day = date.toLocaleDateString('nl-NL', { weekday: 'short', timeZone: 'UTC' });
      const dd  = String(date.getUTCDate()).padStart(2, '0');
      const mm  = String(date.getUTCMonth() + 1).padStart(2, '0');
      const yy  = String(date.getUTCFullYear()).slice(2);
      const result = `${day} ${dd}-${mm}-'${yy}`;
      return result;
    }
    return date.toLocaleDateString('nl-NL', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  formatDatetime(date: Date): string {
    return `${this.formatDate(date)} ${this.toTimeStr(date)}`;
  }

  toTimeStr(date: Date | null): string {
    if (!date) return '00:00';
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // ─── Values exposed to the template for Material binding ──
  // Template binds these instead of value()/start()/end()/departure()/arrival()
  // directly, so Material always sees local-equivalent Dates.

  displayValue     = computed(() => this.toLocalDisplayDate(this.value()));
  displayStart     = computed(() => this.mode() === 'date-range'
    ? this.toLocalDisplayDate(this.start())
    : this.toLocalDisplayDate(this.departure()));
  displayEnd       = computed(() => this.mode() === 'date-range'
    ? this.toLocalDisplayDate(this.end())
    : this.toLocalDisplayDate(this.arrival()));

  // ─── Open ─────────────────────────────────────────────────

  open() {
    if (this.disabled()) return;
    if (this.mode() === 'date') this.singlePicker.open();
    else this.rangePicker.open();
  }

  // ─── Single date ──────────────────────────────────────────

  onSingleChange(date: Date | null) {
    this.valueChange.emit(date ? this.toUTCMidnight(date) : null);
  }

  // ─── Range / datetime-range ───────────────────────────────

  onRangeStartChange(date: Date | null) {
    if (this.mode() === 'date-range') {
      this.startChange.emit(date ? this.toUTCMidnight(date) : null);
    } else {
      if (!date) {
        this.departureChange.emit(null);
        return;
      }
      const utcDate = this.toUTCMidnight(date);
      if (this.departure()) {
        utcDate.setUTCHours(this.departure()!.getUTCHours(), this.departure()!.getUTCMinutes(), 0, 0);
      }
      this.departureChange.emit(utcDate);
    }
  }

  onRangeEndChange(date: Date | null) {
    console.log(date);
    if (this.mode() === 'date-range') {
      this.endChange.emit(date ? this.toUTCMidnight(date) : null);
    } else {
      if (!date) {
        this.arrivalChange.emit(null);
        return;
      }
      const utcDate = this.toUTCMidnight(date);
      const refTime = this.arrival() || this.departure() || new Date();
      utcDate.setUTCHours(refTime.getUTCHours(), refTime.getUTCMinutes(), 0, 0);
      const dep = this.departure();
      if (dep && this.isSameDay(dep, utcDate) && utcDate.getTime() < dep.getTime()) {
        utcDate.setUTCHours(dep.getUTCHours(), dep.getUTCMinutes(), 0, 0);
      }
      console.log('to UTC', utcDate.toUTCString());
      this.arrivalChange.emit(utcDate);
    }
  }

  onPickerClosed() {
    // (unchanged - dead code kept as-is per your existing comment block)
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
      if (this.isSameDay(s, e)) return this.formatDate(s!);
      return `${this.formatDate(s!)} – ${this.formatDate(e!)}`;
    }

    if (m === 'datetime-range') {
      const dep = this.departure(), arr = this.arrival();
      if (!dep || !arr) return null;

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
      updated.setUTCHours(num);
    } else {
      num = Math.max(0, Math.min(59, isNaN(num) ? 0 : num));
      updated.setUTCMinutes(num);
    }
    updated.setUTCSeconds(0, 0);

    if (this.isSameDay(dep, arr)) {
      if (type === 'arrival' && dep && updated.getTime() < dep.getTime()) {
        this.departureChange.emit(new Date(updated));
      }
      if (type === 'departure' && arr && updated.getTime() > arr.getTime()) {
        this.arrivalChange.emit(new Date(updated));
      }
    }

    (type === 'departure') ? this.departureChange.emit(updated) : this.arrivalChange.emit(updated);
  }

  formatPart(num: number | undefined): string {
    if (num === undefined) return '00';
    return String(num).padStart(2, '0');
  }

  isSameDay(d1: Date | null, d2: Date | null): boolean {
    if (!d1 || !d2) return false;
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
  }
}