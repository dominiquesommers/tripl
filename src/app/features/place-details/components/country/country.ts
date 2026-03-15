import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {CostBadge} from '../../../../components/ui/cost-badge/cost-badge';
import {CountryNote, ICountryNote, UpdateCountryNote} from '../../../../models/country-note';
import {Country as CountryModel} from '../../../../models/country';

@Component({
  selector: 'app-country',
  standalone: true,
  imports: [CommonModule, FormsModule, CostBadge, LucideAngularModule],
  templateUrl: './country.html',
  styleUrl: './country.css'
})
export class Country {
  private sanitizer = inject(DomSanitizer);

  country = input.required<CountryModel>();
  tripService = inject(TripService);

  // Track which note description has focus for the URL parser
  focusedNoteId = signal<string | null>(null);
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

  blurDescription(note: CountryNote, description: string) {
    console.log('blur!');
    this.focusedNoteId.set(null);
    this.updateNote(note, { description })
  }

  startAdding() {
    this.isAdding.set(true);
  }

  submitQuickAdd(event: any, countryId: string) {
    const text = event.target.value.trim();
    if (text) {
      this.tripService.addCountryNote(countryId, text).subscribe((newNote) => {
        if (newNote) {
          this.isAdding.set(false);
        }
      });
    } else {
      this.isAdding.set(false);
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    const countryId = this.country().id;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitQuickAdd(event, countryId);
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

  updateNote(note: CountryNote, changes: UpdateCountryNote) {
    console.log('Updating note', note, changes);
    // const updated = { ...note, ...changes };
    this.tripService.updateCountryNote(note.id, changes).subscribe({
      next: () => console.log('Updated country note successfully in the server'),
      error: (err) => console.error('Failed to update note...', err)
    });
  }

  deleteNote(note: CountryNote) {
    if (confirm('Are you sure you want to delete this note?')) {
      this.tripService.removeCountryNote(note).subscribe({
        next: () => console.log('Removed country note successfully in the server'),
        error: (err) => console.error('Failed to remove note...', err)
      });
    }
  }
}
