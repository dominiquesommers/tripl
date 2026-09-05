import {Component, computed, effect, inject, input, output, Signal, signal} from '@angular/core';
import {LucideAngularModule } from 'lucide-angular';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {Visit} from '../../models/visit';
import {TripService} from '../../services/trip';
import {Traverse} from '../../models/traverse';
import {CommonModule} from '@angular/common';
import {Route} from '../../models/route';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {ROUTE_COLORS, ROUTE_ICONS} from '../map-handler/config/map-styles.config';
import {UiService} from '../../services/ui';
import {EditableBadge} from '../ui/editable-badge/editable-badge';
import {AuthService} from '../../services/auth';
import {OverlayMenu} from '../ui/overlay-menu/overlay-menu';
import {OverlayMenuAction} from '../../models/overlay-menu';
import { NotificationService } from '../../services/notification';

@Component({
  selector: 'app-visit-popup',
  standalone: true,
  imports: [LucideAngularModule, DragDropModule, CommonModule, CdkTextareaAutosize, EditableBadge, OverlayMenu],
  templateUrl: './visit-popup.html',
  styleUrl: './visit-popup.css',
})
export class VisitPopup {
  readonly tripService = inject(TripService);
  readonly uiService = inject(UiService);
  readonly notificationService = inject(NotificationService);
  authService = inject(AuthService);

  visit = input.required<Visit>();
  isManagingTraverses = signal(false);
  isManagingRentUntil = signal(false);

  isSourceVisit = computed(() => this.tripService.plan()?.sourceVisit()?.id === this.visit().id);

  readonly pinTooltip = computed(() => {
    const v = this.visit();
    if (!v.included()) {
      return 'Click to include in itinerary options';
    }
    if (!v.entryDate()) {
      return 'Click to explicitly exclude from itinerary';
    }
    return 'Click to exclude and recalculate itinerary';
  });

  readonly visitMenuActions = computed((): OverlayMenuAction[] => {
    const actions: OverlayMenuAction[] = [
      {
        icon: this.visit().included() ? 'map-pin-off' : 'map-pin-check',
        label: this.visit().included() ? 'Exclude from itinerary' : 'Include in itinerary',
        action: () => this.toggleIncluded(),
      },
    ];

    const leg = this.nextLeg();
    if (leg) {
      const activeRental = this.getActiveRentalForLeg(leg.traverse);
      if (activeRental === leg.traverse) {
        actions.push({ icon: 'milestone', label: 'Unset as tour start', action: () => this.toggleStartOfTour() });
      } else if (!activeRental || activeRental.route.type() !== leg.traverse.route.type()) {
        actions.push({ icon: 'milestone', label: 'Set as tour start', action: () => this.toggleStartOfTour() });
      }
    }

    actions.push(
      {
        icon: this.isSourceVisit() ? 'flag-off' : 'flag',
        label: this.isSourceVisit() ? 'Unset as itinerary start' : 'Set as itinerary start',
        action: () => this.toggleSource(),
      },
      {
        icon: 'trash-2',
        label: 'Delete visit',
        action: () => this.delete(),
        className: 'delete-option',
      },
    );

    return actions;
  });

  isFlagHovered = false;

  constructor() {
    effect(() => {
      this.visit();
      this.isManagingTraverses.set(false);
      this.isManagingRentUntil.set(false);
    });
  }

  toggleManagingTraverses(event: MouseEvent) {
    event.stopPropagation(); // Prevents flyTo when clicking the edit icon
    this.isManagingTraverses.update(v => !v);
  }

  toggleManagingRentUntil(event: MouseEvent) {
    event.stopPropagation(); // Prevents flyTo when clicking the edit icon
    this.isManagingRentUntil.update(v => !v);
  }

  setRentUntil(visit: Visit) {
    const traverse = this.nextLeg()?.traverse;
    if (!traverse) return;
    this.tripService.updateTraverse(traverse.id, {rent_until: visit.id}).subscribe();
  }

  toggleStartOfTour() {
    const traverse = this.nextLeg()?.traverse;
    if (!traverse) return;
    if (traverse.rent_until()) {
      this.tripService.updateTraverse(traverse.id, {rent_until: null}).subscribe();
    } else {
      const options: Visit[] = this.rentUntilOptions();
      this.tripService.updateTraverse(traverse.id, {rent_until: options[options.length - 1].id}).subscribe(() => {
        this.isManagingRentUntil.set(true);
      });
    }
  }

  onFlyTo(visit?: Visit | null) {
    const place = visit?.place;
    if (!visit || !place) return;
    this.uiService.triggerFlyTo({center: [place.lng, place.lat]});
    this.uiService.selectVisit(visit.id);
  }

  highlightTraverse(traverse?: Traverse | null) {
    this.uiService.hoveredRoute.set(traverse?.route ?? null);
  }

  clearTraverseHighlight() {
    this.uiService.hoveredRoute.set(null);
  }

  highlightVisit(visit?: Visit | null) {
    this.uiService.hoveredVisit.set(visit ?? null);
  }

  clearVisitHighlight() {
    this.uiService.hoveredVisit.set(null);
  }

  toggleAccommodation(traverse: Traverse) {
    this.tripService.updateTraverse(traverse.id, {includes_accommodation: !traverse.includes_accommodation()}).subscribe();
  }

  toggleOvernight(event: MouseEvent, traverse: Traverse) {
    event.stopPropagation();
    this.tripService.updateTraverse(traverse.id, {is_overnight: !traverse.is_overnight()}).subscribe();
  }

  getRouteIcon(type: string | undefined | null): string {
    return ROUTE_ICONS[type as keyof typeof ROUTE_ICONS];
  }

  getRouteColor(type: string | undefined | null): string {
    return ROUTE_COLORS[type as keyof typeof ROUTE_COLORS];
  }

  previousLeg = computed(() => {
    const previousTraverse = this.visit().previousTraverse();
    if (!previousTraverse) {
      const nextWouldBeTraverse = this.visit().ingoingTraverses()[0];
      if (!nextWouldBeTraverse) return null;
      if (this.visit().inItinerary() && nextWouldBeTraverse.id !== nextWouldBeTraverse.source.nextTraverse()?.id) return null;
      return {traverse: nextWouldBeTraverse, planned: false};
    }
    return {traverse: previousTraverse, planned: true};
  });

  nextLeg = computed(() => {
    const nextTraverse = this.visit().nextTraverse();
    if (!nextTraverse) {
      const nextWouldBeTraverse = this.visit().outgoingTraverses()[0];
      if (!nextWouldBeTraverse) return null;
      return {traverse: nextWouldBeTraverse, planned: false};
    }
    return {traverse: nextTraverse, planned: true};
  });

  rentUntilOptions: Signal<Visit[]> = computed(() => {
    const nextLeg = this.nextLeg();
    if (!nextLeg || !nextLeg.planned) return [];
    const nextTraverse = nextLeg.traverse;
    const routeType = nextTraverse.route.type();
    const itineraryTraverses = this.tripService.plan()?.itineraryTraverses();
    if (!itineraryTraverses) return [];

    const traverseIndex = itineraryTraverses.indexOf(nextTraverse);
    const tourTargets: Visit[] = [];
    let nonMatchingCount = 0;
    for (let i = traverseIndex; i < itineraryTraverses.length; i++) {
      const current = itineraryTraverses[i];
      if (current.route.type() === routeType) {
        if (i > traverseIndex && current.rent_until()) {
          break;
        }

        nonMatchingCount = 0;
        tourTargets.push(current.target);
      } else {
        nonMatchingCount++;
      }
      if (nonMatchingCount >= 3) {
        break;
      }
    }
    return tourTargets;
  });

  persistNights(value: number ) {
    if (value !== this.visit().nights()) {
      this.tripService.updateVisit(this.visit().id, { nights: value })
        .subscribe({
          next: (updatedVisit) => console.log('Nights saved successfully'),
          error: (err) => {
            console.error('Failed to save nights', err);
          }
        });
    }
  }

  handleDrop(event: CdkDragDrop<any[]>) {
    if (event.previousIndex !== event.currentIndex) {
      const traverses = this.visit().outgoingTraverses();
      const movedTraverse = traverses[event.previousIndex];
      let newPriority: number;
      if (event.currentIndex === 0) {
        newPriority = traverses[0].priority() - 1;
      } else if (event.currentIndex >= traverses.length - 1) {
        newPriority = traverses[traverses.length - 1].priority() + 1;
      } else {
        newPriority = (traverses[event.currentIndex - 1].priority() + traverses[event.currentIndex].priority()) / 2;
      }
      this.tripService.updateTraverse(movedTraverse.id, { priority: newPriority })
      .subscribe({
        next: () => console.log('Updated connection successfully.'),
        error: (err) => console.error('Failed to update traverse...', err)
      });
    }
  }

  saveName(newName: string) {
    const place = this.visit().place;
    if (!place) return;
      this.tripService.updatePlace(place.id, { name: newName }).subscribe({
      next: (updatedPlace) => console.log('Update successful'),
      error: (err) => console.error('Update failed', err)
    });
  }

  toggleSource() {
    const newSourceVisitId = this.isSourceVisit() ? null : this.visit().id;
    if (this.tripService.plan()!.sourceVisit() !== null) {
      const confirmMessage = this.isSourceVisit() ? 'Are you sure you want to deselect this visit as the source?' : 'Are you sure you want to set this visit as the source?';
      this.notificationService.confirmModal(
        {
          title: this.isSourceVisit() ? 'Deselect as source' : 'Select as source',
          message: confirmMessage,
          confirmLabel: 'Confirm'
        },
        () => {
          this.tripService.updateCurrentPlan({ source_visit_id: newSourceVisitId }).subscribe();
        }
      );
    } else {
      this.tripService.updateCurrentPlan({ source_visit_id: newSourceVisitId }).subscribe();
    }
  }

  delete() {
    const visit = this.visit();
    this.notificationService.confirmModal(
      {
        title: 'Remove visit',
        message: 'Are you sure you want to remove this visit?',
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeVisit(visit).subscribe({
          next: () => {
            this.uiService.clearSelection();
            const placeId = visit.place_id;
            const currentTrip = this.tripService.trip();
            const currentPlan = this.tripService.plan();
            if (!currentTrip || !currentPlan) return;
            const place = currentTrip.places().get(placeId);

            const remainingVisitsInCurrentPlan = Array.from(
              currentPlan.visits().values() ?? []
            ).filter(v => v.place_id === placeId);

            if (remainingVisitsInCurrentPlan.length > 0 || !place || !currentPlan.id) {
              // still used in this plan (or no place/plan context) — nothing more to do
              return;
            }

            place.update({in_plans: place.in_plans().filter(id => id !== currentPlan.id)});
            const otherPlanIds = place.in_plans();

            if (otherPlanIds.length > 0) {
              const otherPlanNames = this.tripService.trips().find(t => t.id === currentTrip.id)!.plans().filter(p => otherPlanIds.includes(p.id)).map(p => p.name());
              this.notificationService.notify(
                `${place.name()} is still used in ${otherPlanIds.length} other plan${otherPlanIds.length > 1 ? 's' : ''} (${otherPlanNames.join(', ')}), so it can not yet be removed.`
              );
              return;
            }

            this.promptRemovePlace(placeId);
          }
        });
      }
    );
  }

  private promptRemovePlace(placeId: string) {
    const place = this.tripService.trip()?.places().get(placeId);
    if (!place) return;
    this.notificationService.confirmModal(
      {
        title: 'Remove place',
        message: `No more visits for ${place.name()}. Would you like to remove the place from your trip too?`,
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removePlace(place).subscribe({
          next: () => console.log('Removed place successfully.'),
          error: (err) => console.error('Failed to remove place...', err)
        });
      }
    );
  }

  moveToTop(traverse?: Traverse | null) {
    const topPriorityTraverse = this.visit().outgoingTraverses()[0];
    if (!traverse || (topPriorityTraverse.id === traverse.id)) return;
    this.tripService.updateTraverse(traverse.id, { priority: topPriorityTraverse.priority() - 1 })
    .subscribe({
      next: () => console.log('Updated traverse successfully.'),
      error: (err) => console.error('Failed to update traverse...', err)
    });
  }

  onDeleteTraverse(event: MouseEvent, traverse?: Traverse | null) {
    event.stopPropagation();
    if (!traverse) return;

    this.notificationService.confirmModal(
      {
        title: 'Remove connection',
        message: 'Are you sure you want to remove this route connection?',
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeTraverse(traverse).subscribe({
          next: () => {
            const routeId = traverse.route_id;
            const currentTripId = this.tripService.trip()?.id;
            const currentPlanId = this.tripService.plan()?.id;
            const route = this.tripService.trip()?.routes().get(routeId);

            const remainingTraversesInCurrentPlan = Array.from(
              this.tripService.plan()?.traverses().values() ?? []
            ).filter(t => t.route_id === routeId);

            if (remainingTraversesInCurrentPlan.length > 0 || !route || !currentPlanId || !currentTripId) {
              return;
            }

            route.update({in_plans: route.in_plans().filter(id => id !== currentPlanId)});

            const otherPlanIds = route.in_plans();
            if (otherPlanIds.length > 0) {
              const trip = this.tripService.trips().find(t => t.id === currentTripId);
              const otherPlanNames = (trip?.plans() ?? [])
                .filter(p => otherPlanIds.includes(p.id))
                .map(p => p.name());
              this.notificationService.notify(
                `This route is still used in ${otherPlanIds.length} other plan${otherPlanIds.length > 1 ? 's' : ''} (${otherPlanNames.join(', ')}), so it can not yet be removed.`
              );
              return;
            }

            this.promptRemoveRoute(routeId);
          },
          error: (err) => console.error('Failed to remove connection...', err)
        });
      }
    );
  }

  private promptRemoveRoute(routeId: string) {
    const route = this.tripService.trip()?.routes().get(routeId);
    if (!route) return;
    this.notificationService.confirmModal(
      {
        title: 'Remove route',
        message: `No more connections use this route. Would you like to remove it from your trip too?`,
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeRoute(route).subscribe({
          next: () => console.log('Removed route successfully.'),
          error: (err) => console.error('Failed to remove route...', err)
        });
      }
    );
  }

  includeNextVisit(event: MouseEvent, visit?: Visit | null) {
    event.stopPropagation();
    if (!visit || visit.included()) return;
    visit.included.set(true);
    this.tripService.updateVisit(visit.id, { included: true })
    .subscribe({
      next: () => console.log('Included status synced with server'),
      error: (err) => {
        visit.included.set(false);
        console.error('Failed to sync included status, reverting UI...', err);
      }
    });
  }

  excludeNextVisit(event: MouseEvent, visit?: Visit | null) {
    event.stopPropagation();
    if (!visit || !visit.included()) return;
    visit.included.set(false);
    this.tripService.updateVisit(visit.id, { included: false })
    .subscribe({
      next: () => console.log('Included status synced with server'),
      error: (err) => {
        visit.included.set(true);
        console.error('Failed to sync included status, reverting UI...', err);
      }
    });
  }

  toggleIncluded() {
    const visitInstance = this.visit();
    const previousValue = visitInstance.included();
    const newValue = !previousValue;
    visitInstance.included.set(newValue);
    this.tripService.updateVisit(visitInstance.id, { included: newValue })
    .subscribe({
      next: () => console.log('Included status synced with server'),
      error: (err) => {
        visitInstance.included.set(previousValue);
        console.error('Failed to sync included status, reverting UI...', err);
      }
    });
  }

  onRouteClick(event: MouseEvent, route?: Route | null) {
    event.stopPropagation();
    const places = [route?.source, route?.target];
    if (!route || !places[0] || !places[1]) return;
    this.uiService.triggerFlyTo({center: route.middlePoint()});
    this.uiService.selectRoute(route.id);
  }

  addNewTraverse() {
    this.uiService.drawingState.set({
      active: true,
      sourceVisit: this.visit(),
      preselectedRoute: undefined
    });
    this.uiService.clearSelection();
  }

  getActiveRentalForLeg(traverse: Traverse): Traverse | null {
    const sources = traverse.activeRentalSources();
    if (sources.length === 0) return null;

    // 1. Try to find the exact match for this traverse's specific route type first
    const exactMatch = sources.find(r => r.route.type() === traverse.route.type());
    if (exactMatch) {
      return exactMatch;
    }

    // 2. If none match the route type (intervening segment), pick the closest one 
    // (the one whose source visit appears latest in the itinerary)
    const itinerary = this.tripService.plan()?.itinerary() ?? [];
    
    return sources.reduce((latest, current) => {
      const latestIndex = itinerary.findIndex(v => v.id === latest.source_visit_id);
      const currentIndex = itinerary.findIndex(v => v.id === current.source_visit_id);
      return currentIndex > latestIndex ? current : latest;
    }, sources[0]);
  }

  activeRentalStartForLeg(traverse: Traverse): Visit | null {
    const activeRental = this.getActiveRentalForLeg(traverse);
    if (!activeRental || !activeRental.rent_until()) {
      return null;
    }
    return activeRental.source;
  }

  activeRentalEndForLeg(traverse: Traverse): Visit | null {
    const activeRental = this.getActiveRentalForLeg(traverse);
    if (!activeRental || !activeRental.rent_until()) {
      return null;
    }
    return this.tripService.plan()!.visits()!.get(activeRental.rent_until()!)!;
  }

  sortRentalsByRouteType(rentals: Traverse[]): Traverse[] {
    return [...rentals].sort((a, b) => {
      const typeA = a.route.type();
      const typeB = b.route.type();

      if (!typeA && !typeB) return 0;
      if (!typeA) return 1;
      if (!typeB) return -1;

      return typeA.localeCompare(typeB);
    });
  }
}
