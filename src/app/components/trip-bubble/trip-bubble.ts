import {Component, ElementRef, HostListener, inject, input, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { TripService } from '../../services/trip';
import { Plan } from '../../models/plan';
import {Trip} from '../../models/trip';
import {IUserPlan, IUserTrip} from '../../models/user';

@Component({
  selector: 'app-trip-bubble',
  standalone: true,
  imports: [CommonModule, DragDropModule], // DragDropModule is required here
  templateUrl: './trip-bubble.html',
  styleUrls: ['./trip-bubble.css']
})
export class TripBubble {
  private eRef = inject(ElementRef);
  tripService = inject(TripService);
  router = inject(Router);

  showPlanMenu = false;
  showTripMenu = false;
  activeMenuId = signal<string | null>(null);

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
  }

  togglePlanMenu(event: Event) {
    event.stopPropagation();
    this.showTripMenu = false;
    this.showPlanMenu = !this.showPlanMenu;
  }

  toggleItemMenu(plan: IUserPlan, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeMenuId() === plan.id) {
      this.activeMenuId.set(null);
    } else {
      this.activeMenuId.set(plan.id);
    }
  }

  selectTrip(trip: IUserTrip) {
    console.log('select trip.')
    this.router.navigate(['trip', trip.id]);
    this.showTripMenu = false;
  }

  selectPlan(plan: IUserPlan) {
    console.log('select plan.')
    const currentTrip = this.tripService.trip();
    if (currentTrip) {
      this.router.navigate(['trip', currentTrip.id, plan.id]);
    }
    this.showPlanMenu = false;
  }

  renameTrip(trip: IUserTrip, newName: string) {
    console.log('rename trip.')
    // 1. TODO Update DB via API
    // this.tripService.apiService.patchTrip(trip.id, { name: newName }).subscribe();
    // 2. Update local signal state (optional if service re-fetches)
    trip.name = newName;
  }

  renamePlan(plan: IUserPlan, newName: string) {
    console.log('rename plan.')
    // 1. TODO Update DB via API
    // this.tripService.apiService.patchPlan(trip.id, { name: newName }).subscribe();
    // 2. Update local signal state (optional if service re-fetches)
    plan.name = newName;
  }

  dropPlan(event: CdkDragDrop<Plan[]>) {
    console.log('dropped plan.')
    // const currentTrip = this.tripService.trip();
    // if (!currentTrip) return;
    //
    // const plans = [...currentTrip.plans()];
    // moveItemInArray(plans, event.previousIndex, event.currentIndex);
    //
    // // Update priorities based on new index
    // plans.forEach((p, i) => p.priority = i);

    // Sync with server
    // this.tripService.savePlanOrder(plans);
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
    console.log('add trip')
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

  copyPlan(plan: IUserPlan, event: Event) {
    console.log('copy plan', plan.id)
    event.stopPropagation(); // Don't trigger the 'selectPlan' navigation
    // this.tripService.duplicatePlan(plan.id);
  }
}
