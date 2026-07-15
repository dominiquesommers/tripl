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
  showMemberMenu = false;
  activeMenuId = signal<string | null>(null);

  canEdit = computed(() => this.authService.canEdit());

  selectedTripName = computed(() => {
    const trip = this.tripService.trip();
    const user = this.authService.user();
    if (!trip) return 'Select Trip';
    const owner = trip.owner();
    const isOwner = !!user && owner?.id === user.uid;
    console.log('isOwner', isOwner, owner?.id, user?.uid);
    const suffix = (!isOwner && owner) ? ` (${this.getInitials(owner.display_name)})` : '';
    console.log('selectedTripName', trip.name(), suffix);
    return trip.name() + suffix;
  });

  selectedUserTrip = computed(() => {
    const trip = this.tripService.trip();
    if (!trip) return null;
    return this.tripService.trips().find(t => t.id === trip.id);
  });

  sortedPlans = computed(() => {
    const plans = this.tripService.plans() || [];
    return [...plans].sort((a, b) => a.priority() - b.priority());
  });

  // Trips with role owner or member, sorted by priority
  ownerMemberTrips = computed(() => {
    const trips = this.tripService.trips() || [];
    return [...trips]
      .filter(t => t.role() !== 'viewer')
      .sort((a, b) => a.priority() - b.priority());
  });

  // Trips with role viewer, sorted by priority
  viewerTrips = computed(() => {
    const trips = this.tripService.trips() || [];
    return [...trips]
      .filter(t => t.role() === 'viewer')
      .sort((a, b) => a.priority() - b.priority());
  });

  selectedTripSortedMembers = computed(() => {
    return [...this.tripService.trip()?.members().filter(m => m.role() !== 'viewer') || []].sort((a, b) => {
      return a.joined_at.localeCompare(b.joined_at) ||
             a.display_name.localeCompare(b.display_name);
    });
  });

  selectedTripSortedViewers = computed(() => {
    return [...this.tripService.trip()?.members().filter(m => m.role() === 'viewer') || []].sort((a, b) => {
      return a.joined_at.localeCompare(b.joined_at) ||
             a.display_name.localeCompare(b.display_name);
    });
  });

  constructor() {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.eRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.showPlanMenu = false;
      this.showTripMenu = false;
      this.showMemberMenu = false;
      this.activeMenuId.set(null);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.showPlanMenu = false;
    this.showTripMenu = false;
    this.showMemberMenu = false;
  }

  toggleTripMenu(event: Event) {
    event.stopPropagation();
    this.showPlanMenu = false;
    this.showMemberMenu = false;
    this.showTripMenu = !this.showTripMenu;
  }

  togglePlanMenu(event: Event) {
    event.stopPropagation();
    this.showTripMenu = false;
    this.showMemberMenu = false;
    this.showPlanMenu = !this.showPlanMenu;
  }

  toggleMemberMenu(event: Event) {
    event.stopPropagation();
    this.showTripMenu = false;
    this.showPlanMenu = false;
    this.showMemberMenu = !this.showMemberMenu;
  }

  toggleItemMenu(plan: UserPlan, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeMenuId() === plan.id) {
      this.activeMenuId.set(null);
    } else {
      this.activeMenuId.set(plan.id);
    }
  }

  isOwnerOrMember(t: UserTrip): boolean {
    return t.role() !== 'viewer';
  }

  isOwner(t: UserTrip): boolean {
    return t.role() === 'owner';
  }

  displayTripName(t: UserTrip): string {
    const base = t.name();
    if (t.role() !== 'owner' && t.owner_name) {
      return `${base} (${this.getInitials(t.owner_name)})`;
    }
    return base;
  }

  private getInitials(name: string): string {
    console.log('getInitials', name);
    return name
      .trim()
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  selectTrip(trip: UserTrip) {
    this.router.navigate(['trip', trip.id]);
    this.showTripMenu = false;
  }

  selectPlan(plan: UserPlan) {
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
      const newPriority = this.computeNewPriority(plans, event.previousIndex, event.currentIndex);
      this.tripService.updatePlan(movedPlan.id, { priority: newPriority })
      .subscribe({
        next: () => {
          console.log('Updated plan successfully in the server');
        },
        error: (err) => console.error('Failed to update plan...', err)
      });
    }
  }

  // Reorder within the owner/member group
  dropOwnerMemberTrip(event: CdkDragDrop<UserTrip[]>) {
    const trips = this.ownerMemberTrips();
    if (trips.length === 0) return;
    if (event.previousIndex !== event.currentIndex) {
      const movedTrip = trips[event.previousIndex];
      const newPriority = this.computeNewPriority(trips, event.previousIndex, event.currentIndex);
      this.tripService.updateTripMember(`${movedTrip.id}|${this.authService.user()?.uid}`, { priority: newPriority }).subscribe({
        next: () => console.log('Updated trip priority successfully in the server'),
        error: (err) => console.error('Failed to update trip priority...', err)
      });
    }
  }

  // Reorder within the viewer group
  dropViewerTrip(event: CdkDragDrop<UserTrip[]>) {
    const trips = this.viewerTrips();
    if (trips.length === 0) return;
    if (event.previousIndex !== event.currentIndex) {
      const movedTrip = trips[event.previousIndex];
      const newPriority = this.computeNewPriority(trips, event.previousIndex, event.currentIndex);
      this.tripService.updateTripMember(`${movedTrip.id}|${this.authService.user()?.uid}`, { priority: newPriority }).subscribe({
        next: () => console.log('Updated trip priority successfully in the server'),
        error: (err) => console.error('Failed to update trip priority...', err)
      });
    }
  }

  private computeNewPriority<T extends { priority(): number }>(
    items: T[],
    previousIndex: number,
    currentIndex: number
  ): number {
    if (currentIndex === 0) {
      return items[0].priority() - 1;
    }
    if (currentIndex >= items.length - 1) {
      return items[items.length - 1].priority() + 1;
    }
    const isMovingDown = previousIndex < currentIndex;
    const prevItem = isMovingDown ? items[currentIndex] : items[currentIndex - 1];
    const nextItem = isMovingDown ? items[currentIndex + 1] : items[currentIndex];
    return (prevItem.priority() + nextItem.priority()) / 2;
  }

  updateRole(member: any, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newRole = selectElement.value;
    const tripId = this.tripService.trip()?.id;

    if (tripId) {
      this.tripService.updateTripMember(`${tripId}|${member.id}`, { role: newRole }).subscribe();
    }
  }

  deleteTripMember(member: any, event: Event) {
    event.stopPropagation();
    const tripId = this.tripService.trip()?.id;
    if (tripId) {
      this.tripService.deleteTripMember(`${tripId}|${member.id}`).subscribe();
    }
  }

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
