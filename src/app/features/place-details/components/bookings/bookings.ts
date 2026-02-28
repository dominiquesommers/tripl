import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../../services/trip';
import { LucideAngularModule } from 'lucide-angular';
import {EditableBadge} from '../../../../components/ui/editable-badge/editable-badge';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, EditableBadge],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings {
  public tripService = inject(TripService);
  visit = input.required<any>();

  getCategoryColor(id: string): string {
    switch (id) {
      case 'accommodation': return '#5dade2'; // Blue
      case 'food': return '#58d68d';          // Green
      case 'miscellaneous': return '#f39c12'; // Orange
      default: return '#8e8e93';
    }
  }

  getCostValue(id: string): number {
    const p = this.visit().place; // Assuming place is a signal
    switch (id) {
      case 'accommodation': return p.accommodation_cost() ?? 0;
      case 'food': return p.food_cost() ?? 0;
      case 'miscellaneous': return p.miscellaneous_cost() ?? 0;
      default: return 0;
    }
  }

  updateCost(id: string, newValue: number) {
    // Map the category ID back to the update call
    const updateData = { [`${id}_cost`]: newValue };
    this.tripService.updatePlace(this.visit().place.id, updateData).subscribe();
  }

  // Map our display categories to your service's expected keys
  categories = [
    { id: 'accommodation', label: 'Accommodation', icon: 'hotel' },
    { id: 'food', label: 'Food & Drink', icon: 'utensils' },
    { id: 'miscellaneous', label: 'Miscellaneous', icon: 'shopping-bag' }
  ];
  //
  // updateCost(category: string, newValue: string) {
  //   const amount = parseFloat(newValue) || 0;
  //
  //   // Construct the update object: e.g., { accommodation_cost: 150 }
  //   const updatePayload: any = {};
  //   updatePayload[`${category}_cost`] = amount;
  //
  //   console.log('update cost', updatePayload, this.visit());
  //   this.tripService.updatePlace(this.visit().place.id, updatePayload);
  // }
}
