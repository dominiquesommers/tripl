import {Component, inject, input, computed, signal, untracked, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../../../services/trip';
import {Cost} from '../../../../components/ui/cost/cost';
import {Place} from '../../../../models/place';
import {Activity, IActivity, UpdateActivity} from '../../../../models/activity';
import {NewExpense, UpdateExpense} from '../../../../models/expense';
import {AuthService} from '../../../../services/auth';
import {RichTextarea} from '../../../../components/ui/rich-textarea/rich-textarea';


@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Cost, RichTextarea],
  templateUrl: './activities.html',
  styleUrl: './activities.css'
})
export class Activities {
  place = input.required<Place>();
  tripService = inject(TripService);
  authService = inject(AuthService);

  // Track which activity description has focus for the URL parser
  isAdding = signal(false);

  activities = computed<Activity[]>(() => {
    return this.place().activities();
  });

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

  onAddActivity(text: string) {
    const trimmedText = text.trim();

    if (trimmedText) {
      this.tripService.addActivity(this.place().id, trimmedText).subscribe((newAct) => {
        if (newAct) {
          // We reset the 'adding' state so the ghost UI returns to the "Add Activity" button
          this.isAdding.set(false);
        }
      });
    } else {
      // If they clicked away or hit enter with nothing, just close it
      this.isAdding.set(false);
    }
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
