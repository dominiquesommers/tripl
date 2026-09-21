import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {Route} from '../../../../models/route';
import {RouteNote, IRouteNote, UpdateRouteNote} from '../../../../models/route-note';
import {AuthService} from '../../../../services/auth';
import {RichTextarea} from '../../../../components/ui/rich-textarea/rich-textarea';
import { NotificationService } from '../../../../services/notification';
import {OverlayMenu} from '../../../../components/ui/overlay-menu/overlay-menu';
import {OverlayMenuAction} from '../../../../models/overlay-menu';


@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RichTextarea, OverlayMenu],
  templateUrl: './notes.html',
  styleUrl: './notes.css'
})
export class Notes {
  route = input.required<Route>();
  tripService = inject(TripService);
  authService = inject(AuthService);
  notificationService = inject(NotificationService);

  // Track which note description has focus for the URL parser
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

  readonly noteMenuActions: OverlayMenuAction<RouteNote>[] = [
    {
      icon: 'trash-2',
      label: 'Delete note',
      action: (note) => this.deleteNote(note),
      className: 'delete-option',
    },
  ];

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

  updateNote(note: RouteNote, changes: UpdateRouteNote) {
    console.log('Updating note', note, changes);
    this.tripService.updateRouteNote(note.id, changes).subscribe({
      next: () => console.log('Updated route note successfully.'),
      error: (err) => console.error('Failed to update note...', err)
    });
  }

  deleteNote(note: RouteNote) {
    this.notificationService.confirmModal(
      {
        title: 'Remove note',
        message: 'Are you sure you want to delete this note?',
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeRouteNote(note).subscribe({
          next: () => console.log('Removed route note successfully.'),
          error: (err) => console.error('Failed to remove note...', err)
        });
      }
    );
  }
}