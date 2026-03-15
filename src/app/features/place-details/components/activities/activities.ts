import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {CostBadge} from '../../../../components/ui/cost-badge/cost-badge';
import {Cost} from '../../../../components/ui/cost/cost';
import {Place} from '../../../../models/place';
import {Activity, IActivity, UpdateActivity} from '../../../../models/activity';
import {NewExpense, UpdateExpense} from '../../../../models/expense';


@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Cost],
  templateUrl: './activities.html',
  styleUrl: './activities.css'
})
export class Activities {
  private sanitizer = inject(DomSanitizer);

  place = input.required<Place>();
  tripService = inject(TripService);

  // Track which activity description has focus for the URL parser
  focusedActivityId = signal<string | null>(null);
  isAdding = signal(false);

  activities = computed<Activity[]>(() => {
    return this.place().activities();
  });

  mirrorTexts = signal<Map<string, string>>(new Map());
  addingMirrorText = signal<string>('');

  constructor() {
    effect(() => {
      const place = this.place();
      const activities = place.activities();
      const needsFetching = activities.length > 0 && activities.some(a => !a.descriptionFetched());
      if (needsFetching) {
        untracked(() => {
          this.tripService.fetchActivityDescriptions(place.id).subscribe();
        });
      }
    });
  }

  updateMirror(activityId: string, value: string) {
    this.mirrorTexts.update(m => {
      const newMap = new Map(m);
      newMap.set(activityId, value);
      return newMap;
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
      '<a href="$1" target="_blank" style="color: #93b4d4; text-decoration: underline;">$2</a>');
      // '<a href="$1" target="_blank" style="color: #3b82f6; text-decoration: underline;">$2</a>');
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

  removeActual(activity: Activity) {
    console.log('removeActual', activity.id);
    const expenses = activity.expenses();
    const hasExpenses = expenses.length > 0;
    const total = expenses.reduce((s, e) => s + e.amount(), 0);

    const message = hasExpenses
      ? `This will also remove ${expenses.length} payment(s) totalling €${total}. Are you sure?`
      : `Remove actual cost for this activity?`;

    if (confirm(message)) {
      this.updateActivity(activity, { actual_cost: null });
      expenses.forEach(e => this.deleteExpense(e.id));
    }
  }

  addExpense(activity: Activity, expense: NewExpense) {
    this.tripService.addExpense({
      ...expense,
      activity_id: activity.id,
      trip_id: activity.trip_id,
      category: 'activity',
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
