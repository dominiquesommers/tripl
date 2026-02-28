import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {CostBadge} from '../../../../components/ui/cost-badge/cost-badge';
import {Visit} from '../../../../models/visit';
import {Activity, IActivity, UpdateActivity} from '../../../../models/activity';


@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, CostBadge, LucideAngularModule],
  templateUrl: './activities.html',
  styleUrl: './activities.css'
})
export class Activities {
  private sanitizer = inject(DomSanitizer);

  visit = input.required<Visit>();
  tripService = inject(TripService);

  // Track which activity description has focus for the URL parser
  focusedActivityId = signal<string | null>(null);
  isAdding = signal(false);

  activities = computed<Activity[]>(() => {
    return this.visit().place.activities();
  });

  constructor() {
    effect(() => {
      const place = this.visit().place;
      const activities = place.activities();
      const needsFetching = activities.length > 0 && activities.some(a => !a.descriptionFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchActivityDescriptions(place.id).subscribe();
        });
      }
    });
  }

  blurDescription(activity: Activity, description: string) {
    console.log('blur!');
    this.focusedActivityId.set(null);
    this.updateActivity(activity, { description })
  }

  startAdding() {
    this.isAdding.set(true);
  }

  submitQuickAdd(event: any, placeId: string) {
    const text = event.target.value.trim();
    if (text) {
      this.tripService.addActivity(placeId, text).subscribe((newAct) => {
        if (newAct) {
          this.isAdding.set(false);
        }
      });
    } else {
      this.isAdding.set(false);
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    const placeId = this.visit().place.id;
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

  updateActivity(activity: Activity, changes: UpdateActivity) {
    console.log('Updating activity', activity, changes);
    // const updated = { ...activity, ...changes };
    this.tripService.updateActivity(activity.id, changes).subscribe({
      next: () => console.log('Updated activity successfully in the server'),
      error: (err) => console.error('Failed to update activity...', err)
    });
  }

  deleteActivity(activity: Activity) {
    if (confirm('Are you sure you want to delete this activity?')) {
      this.tripService.removeActivity(activity).subscribe({
        next: () => console.log('Removed activity successfully in the server'),
        error: (err) => console.error('Failed to remove activity...', err)
      });
    }
  }
}
