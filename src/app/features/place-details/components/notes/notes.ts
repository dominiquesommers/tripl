import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {CostBadge} from '../../../../components/ui/cost-badge/cost-badge';
import {Place} from '../../../../models/place';
import {PlaceNote, IPlaceNote, UpdatePlaceNote} from '../../../../models/place-note';


@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, CostBadge, LucideAngularModule],
  templateUrl: './notes.html',
  styleUrl: './notes.css'
})
export class Notes {
  private sanitizer = inject(DomSanitizer);

  place = input.required<Place>();
  tripService = inject(TripService);

  // Track which note description has focus for the URL parser
  focusedNoteId = signal<string | null>(null);
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

  blurDescription(note: PlaceNote, description: string) {
    console.log('blur!');
    this.focusedNoteId.set(null);
    this.updateNote(note, { description })
  }

  startAdding() {
    this.isAdding.set(true);
  }

  submitQuickAdd(event: any, placeId: string) {
    const text = event.target.value.trim();
    if (text) {
      this.tripService.addPlaceNote(placeId, text).subscribe((newNote) => {
        if (newNote) {
          this.isAdding.set(false);
        }
      });
    } else {
      this.isAdding.set(false);
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    const placeId = this.place().id;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitQuickAdd(event, placeId);
    } else if (event.key === 'Escape') {
      this.isAdding.set(false);
    }
  }

  cancelAddingIfEmpty(event: FocusEvent) {
    const textarea = event.target as HTMLTextAreaElement;
    if (!textarea.value.trim()) {
      this.isAdding.set(false);
    }
  }

  formatDescription(text: string): SafeHtml {
    if (!text) return '';
    // Replaces url(https://link.com, Label) with <a href="...">Label</a>
    const html = text.replace(/url\(([^,]+),\s*([^)]+)\)/g,
      '<a href="$1" target="_blank" style="color: #3b82f6; text-decoration: underline;">$2</a>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  updateNote(note: PlaceNote, changes: UpdatePlaceNote) {
    console.log('Updating note', note, changes);
    // const updated = { ...note, ...changes };
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
}
