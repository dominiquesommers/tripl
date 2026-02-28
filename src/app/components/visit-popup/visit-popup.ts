import {Component, computed, effect, inject, input, output, Signal, signal} from '@angular/core';
import {LucideAngularModule } from 'lucide-angular';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';import { Visit } from '../../models/visit';
import {TripService} from '../../services/trip';
import {Traverse} from '../../models/traverse';
import {CommonModule} from '@angular/common';
import {Route} from '../../models/route';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {ROUTE_COLORS} from '../map-handler/config/map-styles.config';
import {UiService} from '../../services/ui';
import {EditableBadge} from '../ui/editable-badge/editable-badge';
import {Place} from '../../models/place';

@Component({
  selector: 'app-visit-popup',
  standalone: true,
  imports: [LucideAngularModule, DragDropModule, CommonModule, CdkTextareaAutosize, EditableBadge],
  templateUrl: './visit-popup.html',
  styleUrl: './visit-popup.css',
})
export class VisitPopup {
  readonly tripService = inject(TripService);
  readonly uiService = inject(UiService);

  visit = input.required<Visit>();
  isManagingTraverses = signal(false);
  isManagingRentUntil = signal(false);

  // TODO move to config.
  private readonly routeIconMap: Record<string, string> = {
    'flying': 'plane',
    'bus': 'bus',
    'train': 'train-front',
    'driving': 'car',
    'boat': 'ship',
  };

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
    // TODO highlight visit
    this.uiService.hoveredVisit.set(visit ?? null);
  }

  clearVisitHighlight() {
    this.uiService.hoveredVisit.set(null);
  }

  toggleAccommodation(traverse: Traverse) {
    console.log('toggleAccommodation', traverse);
    this.tripService.updateTraverse(traverse.id, {includes_accommodation: !traverse.includes_accommodation()}).subscribe();
  }

  getRouteIcon(type: string | undefined | null): string {
    if (!type) return 'milestone';
    return this.routeIconMap[type.toLowerCase()] || 'milestone';
  }

  getRouteColor(type: string | undefined | null): string {
    if (!type) return ROUTE_COLORS.undefined;
    // @ts-ignore
    return ROUTE_COLORS[type.toLowerCase()] || ROUTE_COLORS.undefined;
  }

  previousLeg = computed(() => {
    const previousTraverse = this.visit().previousTraverse();
    if (!previousTraverse) {
      const nextWouldBeTraverse = this.visit().ingoingTraverses()[0];
      if (!nextWouldBeTraverse) return null;
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

  rentingFromVisit: Signal<Visit | null> = computed(() => {
    const nextLeg = this.nextLeg();
    if (nextLeg?.traverse?.rentUntilVisit()) return this.visit();
    const previousLeg = this.previousLeg();
    if (!previousLeg) return null;
    const previousTraverse = previousLeg.traverse;
    if (!previousTraverse || !previousLeg.planned || previousTraverse.route.type() !== 'driving') return null;
    if (previousTraverse.rentUntilVisit()) return previousTraverse.source;
    const itineraryTraverses = this.tripService.plan()?.itineraryTraverses();
    if (!itineraryTraverses) return null;
    const traverseIndex = itineraryTraverses.indexOf(previousTraverse);
    const visitedIdsBetween = [];
    let t_ = null;
    for (let i = traverseIndex - 1; i >= 0; i--) {
      const current = itineraryTraverses[i];
      visitedIdsBetween.push(current.target_visit_id);
      if (current.rent_until() !== null) {
        t_ = current;
        break;
      }
    }
    console.log(visitedIdsBetween);
    if (t_) {
      const deadlineId = t_.rent_until();
      console.log(deadlineId);
      if (deadlineId && visitedIdsBetween.includes(deadlineId)) {
        return null;
      }
      return t_.source ?? null;
    }
    return null;
  });

  rentingUntilVisit: Signal<Visit | null>  = computed(() => {
    const rentingUntilVisit = this.rentingFromVisit()?.nextTraverse()?.rentUntilVisit();
    if (!rentingUntilVisit || rentingUntilVisit === this.visit()) return null;
    return rentingUntilVisit;
  });

  rentUntilOptions: Signal<Visit[]> = computed(() => {
    const nextLeg = this.nextLeg();
    if (!nextLeg || !nextLeg.planned) return [];
    const nextTraverse = nextLeg.traverse;
    if (nextTraverse.route.type() !== 'driving') return [];
    const itineraryTraverses = this.tripService.plan()?.itineraryTraverses();
    if (!itineraryTraverses) return [];

    const traverseIndex = itineraryTraverses.indexOf(nextTraverse);
    const drivingTargets: Visit[] = [];
    let nonDrivingCount = 0;
    for (let i = traverseIndex; i < itineraryTraverses.length; i++) {
      const current = itineraryTraverses[i];
      if (current.route.type() === 'driving') {
        nonDrivingCount = 0;
        drivingTargets.push(current.target);
      } else {
        nonDrivingCount++;
      }
      if (nonDrivingCount >= 3) {
        break;
      }
    }
    return drivingTargets;
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
        next: () => console.log('Updated traverse successfully in the server'),
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

  delete() {
    console.log('delete visit');
    const visit = this.visit();
    if (!confirm('Are you sure you want to remove this visit?')) return;

    this.tripService.removeVisit(visit).subscribe({
      next: () => {
        this.uiService.clearSelection();
        const placeId = visit.place_id;
        const remainingVisits = Array.from(this.tripService.plan()?.visits().values() ?? [])
          .filter(v => v.place_id === placeId);
        if (remainingVisits.length === 0) this.promptRemovePlace(placeId);
      }
    });
  }

  private promptRemovePlace(placeId: string) {
    const place = this.tripService.trip()?.places().get(placeId);
    if (!place) return;
    if (!confirm(`No more visits for ${place.name()}. Would you like to remove the place from your map too?`)) return;
    this.tripService.removePlace(place)
    .subscribe({
      next: () => console.log('Removed place successfully in the server'),
      error: (err) => console.error('Failed to remove place...', err)
    });
  }

  moveToTop(traverse?: Traverse | null) {
    console.log('Move to top', traverse);
    const topPriorityTraverse = this.visit().outgoingTraverses()[0];
    if (!traverse || (topPriorityTraverse.id === traverse.id)) return;
    this.tripService.updateTraverse(traverse.id, { priority: topPriorityTraverse.priority() - 1 })
    .subscribe({
      next: () => console.log('Updated traverse successfully in the server'),
      error: (err) => console.error('Failed to update traverse...', err)
    });
  }

  onDeleteTraverse(event: MouseEvent, traverse?: Traverse | null) {
    event.stopPropagation(); // Prevent the 'moveToTop' click
    if (!traverse) return;
    if (!confirm('Are you sure you want to remove this route connection?')) return;
    this.tripService.removeTraverse(traverse)
    .subscribe({
      next: () => console.log('Removed traverse successfully in the server'),
      error: (err) => console.error('Failed to remove traverse...', err)
    });
  }

  includeNextVisit(event: MouseEvent, visit?: Visit | null) {
    event.stopPropagation(); // Prevent the 'moveToTop' click
    console.log('Set included to true for visit', visit);
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
    event.stopPropagation(); // Prevent the 'moveToTop' click
    console.log('Set included to true for visit', visit);
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
}
