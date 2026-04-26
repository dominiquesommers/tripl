import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {Route} from '../../../../models/route';
import {RouteNote, IRouteNote, UpdateRouteNote} from '../../../../models/route-note';
import {AuthService} from '../../../../services/auth';
import {RichTextarea} from '../../../../components/ui/rich-textarea/rich-textarea';


@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RichTextarea],
  templateUrl: './notes.html',
  styleUrl: './notes.css'
})
export class Notes {
  route = input.required<Route>();
  tripService = inject(TripService);
  authService = inject(AuthService);

  // Track which note description has focus for the URL parser
  // focusedNoteId = signal<string | null>(null);
  isAdding = signal(false);

  notes = computed<RouteNote[]>(() => {
    return this.route().notes();
  });

  constructor() {
    effect(() => {
      const route = this.route();
      const notes = route.notes();
      const needsFetching = notes.length > 0 && notes.some(a => !a.descriptionFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchRouteNoteDescriptions(route.id).subscribe();
        });
      }
    });
  }

  onAddNote(text: string) {
    const trimmedText = text.trim();

    if (trimmedText) {
      this.tripService.addRouteNote(this.route().id, trimmedText).subscribe((newNote) => {
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

  // blurDescription(note: RouteNote, description: string) {
  //   console.log('blur!');
  //   this.focusedNoteId.set(null);
  //   this.updateNote(note, { description })
  // }
  //
  // startAdding() {
  //   this.isAdding.set(true);
  // }
  //
  // submitQuickAdd(event: any, routeId: string) {
  //   const text = event.target.value.trim();
  //   if (text) {
  //     this.tripService.addRouteNote(routeId, text).subscribe((newNote) => {
  //       if (newNote) {
  //         this.isAdding.set(false);
  //       }
  //     });
  //   } else {
  //     this.isAdding.set(false);
  //   }
  // }
  //
  // handleKeyDown(event: KeyboardEvent) {
  //   const routeId = this.route().id;
  //   if (event.key === 'Enter' && !event.shiftKey) {
  //     event.preventDefault();
  //     this.submitQuickAdd(event, routeId);
  //   } else if (event.key === 'Escape') {
  //     this.isAdding.set(false);
  //   }
  // }
  //
  // cancelAddingIfEmpty(event: FocusEvent) {
  //   const textarea = event.target as HTMLTextAreaElement;
  //   if (!textarea.value.trim()) {
  //     this.isAdding.set(false);
  //   }
  // }
  //
  // formatDescription(text: string): SafeHtml {
  //   if (!text) return '';
  //   // Replaces url(https://link.com, Label) with <a href="...">Label</a>
  //   const html = text.replace(/url\(([^,]+),\s*([^)]+)\)/g,
  //     '<a href="$1" target="_blank" style="color: #3b82f6; text-decoration: underline;">$2</a>');
  //   return this.sanitizer.bypassSecurityTrustHtml(html);
  // }

  updateNote(note: RouteNote, changes: UpdateRouteNote) {
    console.log('Updating note', note, changes);
    // const updated = { ...note, ...changes };
    this.tripService.updateRouteNote(note.id, changes).subscribe({
      next: () => console.log('Updated route note successfully in the server'),
      error: (err) => console.error('Failed to update note...', err)
    });
  }

  deleteNote(note: RouteNote) {
    if (confirm('Are you sure you want to delete this note?')) {
      this.tripService.removeRouteNote(note).subscribe({
        next: () => console.log('Removed route note successfully in the server'),
        error: (err) => console.error('Failed to remove note...', err)
      });
    }
  }
}
