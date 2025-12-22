import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { TripService } from '../../services/trip';

@Component({
  selector: 'app-trip-bubble',
  standalone: true,
  imports: [CommonModule, DragDropModule], // DragDropModule is required here
  templateUrl: './trip-bubble.html',
  styleUrls: ['./trip-bubble.css']
})
export class TripBubble {
  showPlanMenu = false;

  constructor(
    public tripService: TripService,
    private router: Router
  ) {}

  togglePlanMenu() {
    this.showPlanMenu = !this.showPlanMenu;
  }

  selectPlan(plan: any) {
    console.log(plan)
    this.tripService.setActivePlan(plan);
    this.showPlanMenu = false; // Close the menu after selecting
    const currentTrip = this.tripService.getCurrentTripValue();
    if (currentTrip) {
      this.router.navigate(['trip', currentTrip.id, plan.id]);
    }
  }

  // Update your drop method to use the service
  drop(event: CdkDragDrop<any[]>, plans: any[]) {
    moveItemInArray(plans, event.previousIndex, event.currentIndex);
    this.tripService.updatePlanPriorities(plans);
  }
}
