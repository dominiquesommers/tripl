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
import {OverlayMenu} from '../ui/overlay-menu/overlay-menu';
import {OverlayMenuAction} from '../../models/overlay-menu';
import { NotificationService } from '../../services/notification';


@Component({
  selector: 'app-trip-bubble',
  standalone: true,
  imports: [CommonModule, DragDropModule, LucideAngularModule, OverlayMenu],
  templateUrl: './trip-bubble.html',
  styleUrls: ['./trip-bubble.css']
})
export class TripBubble {
  private eRef = inject(ElementRef);
  tripService = inject(TripService);
  authService = inject(AuthService);
  notifierService = inject(NotificationService);
  router = inject(Router);

  showPlanMenu = false;
  showTripMenu = false;
  showMemberMenu = false;
  activeMenuId = signal<string | null>(null);

  canEdit = computed(() => this.authService.canEdit());

  getTripMenuActions(t: UserTrip): OverlayMenuAction[] {
    return [{ icon: 'trash-2', label: 'Remove Trip', action: () => this.deleteTrip(t), className: 'delete-option' }];
  }

  getMemberMenuActions(member: any): OverlayMenuAction[] {
    return [{ icon: 'trash-2', label: 'Remove Member', action: () => this.deleteTripMember(member), className: 'delete-option' }];
  }

  getPlanMenuActions(p: UserPlan): OverlayMenuAction[] {
    return [
      { icon: 'copy', label: 'Duplicate Plan', action: () => this.copyPlan(p) },
      { icon: 'trash-2', label: 'Delete Plan', action: () => this.deletePlan(p), className: 'delete-option' },
    ];
  }

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
    const target = event.target as HTMLElement;
    const clickedInside = this.eRef.nativeElement.contains(target);
    const clickedInOverlay = !!target.closest('.cdk-overlay-container');
    if (!clickedInside && !clickedInOverlay) {
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

  deleteTripMember(member: any) {
    const tripId = this.tripService.trip()?.id;
    if (tripId) {
      this.tripService.removeTripMember(`${tripId}|${member.id}`).subscribe();
    }
  }

  addUser() {
    // 1. Get the current URL and strip out plan info (or keep just the base/trip level)
    const currentUrl = window.location.href;

    // Example: If your URL has a plan ID segment you want to strip,
    // or if you want to construct a clean shareable base URL:
    const urlWithoutPlan = window.location.origin + this.router.createUrlTree(['trip', this.tripService.trip()?.id]).toString();

    // 2. Copy to clipboard
    navigator.clipboard.writeText(urlWithoutPlan).then(() => {
      // 3. Show notification using your notifierService
      this.notifierService.notify('Trip link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy URL: ', err);
      this.notifierService.notify('Failed to copy link.', true);
    });
  }

  addTrip() {
    console.log('add trip');

    // TODO add current lat, lng, zoom to the api call.
    this.tripService.addTrip().subscribe({
      next: (new_trip_data) => {
        if (!new_trip_data) {
          console.error('Failed to add trip: received null response.');
          return;
        }
        this.router.navigate(['trip', new_trip_data.trip_id, new_trip_data.plan_id]);
      },
      error: (err) => console.error('Failed to add trip:', err)
    });
  }

  deleteTrip(trip: UserTrip) {
    console.log('delete trip');
    this.notifierService.confirmModal(
      {
        title: `Remove trip ${trip.name()}`,
        message: 'Are you sure you want to remove this trip?',
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeTrip(trip.id).subscribe({
          error: (err) => console.error('Failed to remove trip:', err)
        });
      }
    );
  }

  addPlan() {
    console.log('add plan');
    const tripId = this.tripService.trip()?.id;
    if (!tripId) return;

    // TODO add current lat, lng, zoom to the api call.
    this.tripService.addPlan(tripId).subscribe({
      next: (new_plan_data) => {
        if (!new_plan_data) {
          console.error('Failed to add plan: received null response.');
          return;
        }
        console.log(new_plan_data);
        console.log('navigate to trip', tripId, new_plan_data.plan_id);
        this.router.navigate(['trip', tripId, new_plan_data.plan_id]);
      },
      error: (err) => console.error('Failed to add plan:', err)
    });
  }

  deletePlan(plan: UserPlan) {
    console.log('delete plan');
    this.notifierService.confirmModal(
      {
        title: `Remove plan ${plan.name()}`,
        message: 'Are you sure you want to remove this plan?',
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removePlan(plan.id).subscribe({
          error: (err) => console.error('Failed to remove plan:', err)
        });
      }
    );
  }

  copyPlan(plan: UserPlan) {
    console.log('copy plan', plan.id)
    // this.tripService.duplicatePlan(plan.id);
  }
}
