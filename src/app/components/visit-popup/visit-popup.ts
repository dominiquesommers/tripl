import {Component, computed, inject, input, output, signal} from '@angular/core';
import {LucideAngularModule } from 'lucide-angular';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';import { Visit } from '../../models/visit';
import {TripService} from '../../services/trip';
import {Traverse} from '../../models/traverse';
import {CommonModule} from '@angular/common';
import {Route} from '../../models/route';

@Component({
  selector: 'app-visit-popup',
  standalone: true,
  imports: [LucideAngularModule, DragDropModule, CommonModule ],
  templateUrl: './visit-popup.html',
  styleUrl: './visit-popup.css',
})
export class VisitPopup {
  readonly tripService = inject(TripService);

  visit = input.required<Visit>();
  onSave = output<{id: string, name: string}>();
  onDelete = output<string>();
  isMenuOpen = signal(false);
  isManagingTraverses = signal(false);

  private readonly routeIconMap: Record<string, string> = {
    'flight': 'plane',
    'bus': 'bus',
    'train': 'train',
    'driving': 'car',
    'boat': 'ship',
  };

  toggleManager(event: MouseEvent) {
    event.stopPropagation(); // Prevents flyTo when clicking the edit icon
    this.isManagingTraverses.update(v => !v);
  }

  onFlyTo(place: any) {
    if (!place) return;
    console.log('Fly to place', place);
    // this.tripService.flyTo(place.coordinates());
  }

  highlightTraverse(traverse: any) {
    this.tripService.hoveredRoute.set(traverse.route);
  }

  clearHighlight() {
    this.tripService.hoveredRoute.set(null);
  }

  // toggleMenu(event: MouseEvent) {
  //   event.preventDefault(); // Stop native context menu
  //   this.isMenuOpen.update(v => !v);
  // }

  getRouteIcon(type: string | undefined | null): string {
    if (!type) return 'milestone';
    return this.routeIconMap[type.toLowerCase()] || 'milestone';
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

  saveName(newName: string) {
    console.log('save place name');
  }

  saveNights(newNight: string) {
    console.log('save nights');
  }

  handleDrop(event: CdkDragDrop<any[]>) {
    // If the item was actually moved to a different position
    if (event.previousIndex !== event.currentIndex) {
      const traverses = this.visit().outgoingTraverses();
      const movedTraverse = traverses[event.previousIndex];

      // Send the update to your service
      // Example: move traverse 'X' to position 'Y'
      // this.tripService.reorderTraverses(
      //   this.visit().id,
      //   movedTraverse.id,
      //   event.currentIndex
      // );
    }
  }

  onNextLegRightClick(event: MouseEvent, leg: any) {
    console.log('next leg right click');
  }

  save(newName: string) {
    const place = this.visit().place;
    if (!place) return;
    this.onSave.emit({ id: place.id, name: newName });
  }

  delete() {
    console.log('delete visit');
    this.onDelete.emit(this.visit().id);
  }

  moveToTop(traverse: any) {
    console.log('TODO: move to top', traverse.source_visit_id, traverse.source_target_id);
    // Check if it's already at the top to avoid unnecessary calls
    // if (this.visit().outgoingTraverses()[0].id === traverse.id) return;
    //
    // // Call the same reorder logic as drag-drop, but targeting index 0
    // this.tripService.reorderTraverses(this.visit().id, traverse.id, 0);
  }

  onDeleteTraverse(event: MouseEvent, sourceId?: string, targetId?: string) {
    event.stopPropagation(); // Prevent the 'moveToTop' click
    console.log('TODO: delete traverse', sourceId, targetId);
    // Confirm with user if necessary, then call service
    // if (confirm('Remove this connection option?')) {
    //   this.tripService.deleteTraverse(traverseId);
    // }
  }

  includeNextVisit(event: MouseEvent, visitId?: string) {
    event.stopPropagation(); // Prevent the 'moveToTop' click
    console.log('TODO: set included to true for visit', visitId);
    if (!visitId) return;
    this.tripService.plan()?.visits().get(visitId)?.included.set(true);
  }

  excludeNextVisit(event: MouseEvent, visitId?: string) {
    event.stopPropagation(); // Prevent the 'moveToTop' click
    console.log('TODO: set excluded to true for visit', visitId);
    if (!visitId) return;
    this.tripService.plan()?.visits().get(visitId)?.included.set(false);
  }

  toggleIncluded() {
    console.log('TODO: toggle included for this visit.');
    const current = this.visit().included();
    // this.tripService.updateVisit(this.visit().id, { included: !current });
    this.visit().included.set(!current);
  }

  onRouteClick(event: MouseEvent, route?: Route | null) {
    event.stopPropagation(); // Prevent the 'moveToTop' click
    console.log('TODO: route clicked.', route);
  }

  addNewTraverse() {
    console.log('TODO: Logic to add a new traverse to the visit')
  }
}
