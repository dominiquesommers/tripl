import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {CountryNote, ICountryNote, UpdateCountryNote} from '../../../../models/country-note';
import {Country as CountryModel} from '../../../../models/country';
import {AuthService} from '../../../../services/auth';
import {RichTextarea} from '../../../../components/ui/rich-textarea/rich-textarea';
import {Cost} from '../../../../components/ui/cost/cost';
import {NewExpense, UpdateExpense} from '../../../../models/expense';
import { NotificationService } from '../../../../services/notification';


@Component({
  selector: 'app-country',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RichTextarea, Cost],
  templateUrl: './country.html',
  styleUrl: './country.css'
})
export class Country {
  country = input.required<CountryModel>();
  tripService = inject(TripService);
  authService = inject(AuthService);
  notificationService = inject(NotificationService);

  // Track which note description has focus for the URL parser
  isAdding = signal(false);

  notes = computed<CountryNote[]>(() => {
    return this.country().notes();
  });

  constructor() {
    effect(() => {
      const country = this.country();
      const notes = country.notes();
      const needsFetching = notes.length > 0 && notes.some(a => !a.descriptionFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchCountryNoteDescriptions(country.id).subscribe();
        });
      }
    });
  }

  onAddNote(text: string) {
    const trimmedText = text.trim();

    if (trimmedText) {
      this.tripService.addCountryNote(this.country().id, trimmedText).subscribe((newNote) => {
        if (newNote) {
          // We reset the 'adding' state so the ghost UI returns to the "Add Note" button
          this.isAdding.set(false);
        }
      });
    } else {
      // If they clicked away or hit enter with nothing, just close it
      this.isAdding.set(false);
    }
  }

  updateNote(note: CountryNote, changes: UpdateCountryNote) {
    this.tripService.updateCountryNote(note.id, changes).subscribe({
      next: () => console.log('Updated country note successfully.'),
      error: (err) => console.error('Failed to update note...', err)
    });
  }

  toggleExcluded(note: CountryNote) {
    if (note.status() !== 'excluded') {
      const hasCost = note.actual_cost() !== null || note.expenses().length > 0;
      if (hasCost) {
        alert('This note has recorded costs — mark it skipped instead, or delete its expenses first.');
        return;
      }
    }
    this.updateNote(note, { status: note.status() === 'excluded' ? 'planned' : 'excluded' });
  }

  toggleSkipped(note: CountryNote) {
    this.updateNote(note, { status: note.status() === 'skipped' ? 'planned' : 'skipped' });
  }

  deleteNote(note: CountryNote) {
    this.notificationService.confirmModal(
      {
        title: 'Remove note',
        message: 'Are you sure you want to delete this note?',
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeCountryNote(note).subscribe({
          next: () => console.log('Removed country note successfully.'),
          error: (err) => console.error('Failed to remove note...', err)
        });
      }
    );
  }

  removeActual(note: CountryNote) {
    const expenses = note.expenses();
    const hasExpenses = expenses.length > 0;
    const total = expenses.reduce((s, e) => s + e.amount(), 0);

    const message = hasExpenses
      ? `This will also remove ${expenses.length} payment(s) totalling €${total}. Are you sure?`
      : `Remove actual cost for this country note?`;

    this.notificationService.confirmModal(
      {
        title: 'Remove actual cost',
        message: message,
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.updateNote(note, { actual_cost: null });
        expenses.forEach(e => this.deleteExpense(e.id));
      }
    );
  }

  addExpense(note: CountryNote, expense: NewExpense) {
    this.tripService.addExpense({
      ...expense,
      country_note_id: note.id,
      trip_id: note.trip_id,
      category: 'miscellaneous',
    }).subscribe();
  }

  updateExpense(expense: UpdateExpense & { id: string }) {
    this.tripService.updateExpense(expense.id, expense).subscribe();
  }

  deleteExpense(id: string) {
    const expense = this.tripService.trip()?.expenses().get(id);
    if (expense) this.tripService.removeExpense(expense).subscribe();
  }

  formatVisitDate(date: Date): string {
    const day = date.toLocaleDateString('nl-NL', { weekday: 'short', timeZone: 'UTC' });
    const dd  = String(date.getUTCDate()).padStart(2, '0');
    const mm  = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yy  = String(date.getUTCFullYear()).slice(2);

    // Example output: "ma 13-04-'26"
    return `${day} ${dd}-${mm}-'${yy}`;
  }
}
