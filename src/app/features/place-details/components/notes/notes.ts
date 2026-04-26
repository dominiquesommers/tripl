import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {Place} from '../../../../models/place';
import {PlaceNote, IPlaceNote, UpdatePlaceNote} from '../../../../models/place-note';
import {AuthService} from '../../../../services/auth';
import {RichTextarea} from '../../../../components/ui/rich-textarea/rich-textarea';
import {Cost} from '../../../../components/ui/cost/cost';
import {NewExpense, UpdateExpense} from '../../../../models/expense';


@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RichTextarea, Cost],
  templateUrl: './notes.html',
  styleUrl: './notes.css'
})
export class Notes {
  place = input.required<Place>();
  tripService = inject(TripService);
  authService = inject(AuthService);

  // Track which note description has focus for the URL parser
  isAdding = signal(false);

  notes = computed<PlaceNote[]>(() => {
    return this.place().notes();
  });

  constructor() {
    effect(() => {
      const place = this.place();
      const notes = place.notes();
      const needsFetching = notes.length > 0 && notes.some(a => !a.descriptionFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchPlaceNoteDescriptions(place.id).subscribe();
        });
      }
    });
  }

  onAddNote(text: string) {
    const trimmedText = text.trim();

    if (trimmedText) {
      this.tripService.addPlaceNote(this.place().id, text).subscribe((newNote) => {
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

  updateNote(note: PlaceNote, changes: UpdatePlaceNote) {
    console.log('Updating note', note, changes);
    this.tripService.updatePlaceNote(note.id, changes).subscribe({
      next: () => console.log('Updated place note successfully in the server'),
      error: (err) => console.error('Failed to update note...', err)
    });
  }

  deleteNote(note: PlaceNote) {
    if (confirm('Are you sure you want to delete this note?')) {
      this.tripService.removePlaceNote(note).subscribe({
        next: () => console.log('Removed place note successfully in the server'),
        error: (err) => console.error('Failed to remove note...', err)
      });
    }
  }

  removeActual(note: PlaceNote) {
    console.log('removeActual', note.id);
    const expenses = note.expenses();
    const hasExpenses = expenses.length > 0;
    const total = expenses.reduce((s, e) => s + e.amount(), 0);

    const message = hasExpenses
      ? `This will also remove ${expenses.length} payment(s) totalling €${total}. Are you sure?`
      : `Remove actual cost for this place note?`;

    if (confirm(message)) {
      this.updateNote(note, { actual_cost: null });
      expenses.forEach(e => this.deleteExpense(e.id));
    }
  }

  addExpense(note: PlaceNote, expense: NewExpense) {
    this.tripService.addExpense({
      ...expense,
      place_note_id: note.id,
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
}
