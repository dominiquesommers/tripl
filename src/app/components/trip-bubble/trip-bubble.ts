import {Component, computed, ElementRef, HostListener, inject, input, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { TripService } from '../../services/trip';
import { Plan } from '../../models/plan';
import {Trip} from '../../models/trip';
import {IUserPlan, IUserTrip, UserPlan, UserTrip} from '../../models/user';
import {LucideAngularModule } from 'lucide-angular';
import {AuthService} from '../../services/auth';


@Component({
  selector: 'app-trip-bubble',
  standalone: true,
  imports: [CommonModule, DragDropModule, LucideAngularModule], // DragDropModule is required here
  templateUrl: './trip-bubble.html',
  styleUrls: ['./trip-bubble.css']
})
export class TripBubble {
  private eRef = inject(ElementRef);
  tripService = inject(TripService);
  authService = inject(AuthService);
  router = inject(Router);

  showPlanMenu = false;
  showTripMenu = false;
  activeMenuId = signal<string | null>(null);

  canEdit = computed(() => this.authService.canEdit());

  sortedPlans = computed(() => {
    const plans = this.tripService.plans() || [];
    return [...plans].sort((a, b) => a.priority() - b.priority());
  });

  constructor() {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.eRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.showPlanMenu = false;
      this.showTripMenu = false;
      this.activeMenuId.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.showPlanMenu = false;
    this.showTripMenu = false;
  }

  toggleTripMenu(event: Event) {
    event.stopPropagation();
    this.showPlanMenu = false;
    this.showTripMenu = !this.showTripMenu;
    console.log(this.showTripMenu);
  }

  togglePlanMenu(event: Event) {
    event.stopPropagation();
    this.showTripMenu = false;
    this.showPlanMenu = !this.showPlanMenu;
  }

  toggleItemMenu(plan: UserPlan, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeMenuId() === plan.id) {
      this.activeMenuId.set(null);
    } else {
      this.activeMenuId.set(plan.id);
    }
  }

  selectTrip(trip: UserTrip) {
    console.log('select trip.')
    this.router.navigate(['trip', trip.id]);
    this.showTripMenu = false;
  }

  selectPlan(plan: UserPlan) {
    console.log('select plan.')
    const currentTrip = this.tripService.trip();
    if (currentTrip) {
      this.router.navigate(['trip', currentTrip.id, plan.id]);
    }
    this.showPlanMenu = false;
  }

  renameTrip(trip: UserTrip, newName: string) {
    this.tripService.updateTrip(trip.id, { name: newName }).subscribe({
      next: () => console.log('Trip name updated on server and locally.'),
      error: (err) => console.error(err)
    });
  }

  renamePlan(plan: UserPlan, newName: string) {
    console.log('rename plan.')
    this.tripService.updatePlan(plan.id, { name: newName }).subscribe({
      next: () => console.log('Plan name updated on server and locally.'),
      error: (err) => console.error(err)
    });
  }

  dropPlan(event: CdkDragDrop<Plan[]>) {
    const plans = this.sortedPlans();
    if (plans.length === 0) return;
    if (event.previousIndex !== event.currentIndex) {
      const movedPlan = plans[event.previousIndex];
      let newPriority: number;
      if (event.currentIndex === 0) {
        newPriority = plans[0].priority() - 1;
      } else if (event.currentIndex >= plans.length - 1) {
        newPriority = plans[plans.length - 1].priority() + 1;
      } else {
        const isMovingDown = event.previousIndex < event.currentIndex;
        const prevPlan = isMovingDown ? plans[event.currentIndex] : plans[event.currentIndex - 1];
        const nextPlan = isMovingDown ? plans[event.currentIndex + 1] : plans[event.currentIndex];
        newPriority = (prevPlan.priority() + nextPlan.priority()) / 2;
      }
      this.tripService.updatePlan(movedPlan.id, { priority: newPriority })
      .subscribe({
        next: () => {
          console.log('Updated plan successfully in the server');
        },
        error: (err) => console.error('Failed to update plan...', err)
      });
    }
  }

  dropTrip(event: CdkDragDrop<Trip[]>) {
    console.log('dropped trip.')
    // const trips = this.tripService.trips();
    // if (!!trips) {
    //   moveItemInArray(trips, event.previousIndex, event.currentIndex);
    //   // this.tripService.updateTripPriorities(trip);
    // }
  }

  // dropPlan(event: CdkDragDrop<Plan[]>) {
  //   const plans = this.tripService.plans();
  //   if (!!plans) {
  //     moveItemInArray(plans, event.previousIndex, event.currentIndex);
  //     // this.tripService.updatePlanPriorities(plans);
  //   }
  // }

  addTrip() {
    console.log('add trip');
    // const currentTrip = this.tripService.trip();
    // if (currentTrip) {
      // Call your service to create a new plan
      // After the API returns, the signals will auto-update the list
      // this.tripService.addNewPlan(currentTrip.id);
    // }
  }

  deleteTrip(event: PointerEvent, trip: UserTrip) {
    console.log('delete trip');
    event.stopPropagation();
    // const currentTrip = this.tripService.trip();
    // if (currentTrip) {
      // Call your service to create a new plan
      // After the API returns, the signals will auto-update the list
      // this.tripService.addNewPlan(currentTrip.id);
    // }
  }

  addPlan() {
    console.log('add plan')
    const currentTrip = this.tripService.trip();
    if (currentTrip) {
      // Call your service to create a new plan
      // After the API returns, the signals will auto-update the list
      // this.tripService.addNewPlan(currentTrip.id);
    }
  }

  deletePlan(event: PointerEvent, plan: UserPlan) {
    console.log('delete plan')
    event.stopPropagation();
    // const currentTrip = this.tripService.trip();
    // if (currentTrip) {
      // Call your service to create a new plan
      // After the API returns, the signals will auto-update the list
      // this.tripService.addNewPlan(currentTrip.id);
    // }
  }

  copyPlan(plan: UserPlan, event: Event) {
    console.log('copy plan', plan.id)
    event.stopPropagation(); // Don't trigger the 'selectPlan' navigation
    // this.tripService.duplicatePlan(plan.id);
  }
}
