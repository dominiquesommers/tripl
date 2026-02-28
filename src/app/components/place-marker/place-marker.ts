import {Component, computed, HostListener, inject, input, Input, signal, Signal, ElementRef} from '@angular/core';
import {NewVisit, Visit} from '../../models/visit';
import {Place} from '../../models/place';
import {MapInteractionManager} from '../map-handler/utils/interaction-handler';
import {Marker} from 'mapbox-gl';
import {UiService} from '../../services/ui';
import {TripService} from '../../services/trip';
import {RouteType} from '../../models/route';
import {take} from 'rxjs';

@Component({
  selector: 'app-place-marker',
  templateUrl: './place-marker.html',
  styleUrl: './place-marker.css',
})
export class PlaceMarker {
  public elementRef = inject(ElementRef);

  place = input.required<Place>();
  @Input() hoveredPlace!: Signal<Place | null>;
  @Input() hoveredVisit!: Signal<Visit | null>;
  readonly isHovered = computed(() => this.place() === this.hoveredPlace());
  @Input() selectedVisit!: Signal<Visit | null>;
  readonly isSelected = computed(() => this.place() === this.selectedVisit()?.place);
  zoom = input.required<Signal<number>>();
  readonly isZoomLow = computed(() => this.zoom()() < 3.5);
  public interactionManager!: MapInteractionManager;
  private _marker = signal<Marker | null>(null);
  public marker = this._marker.asReadonly();

  sortedVisits = computed(() => {
    const visits = this.place().visits();
    if (!visits) return [];
    return [...visits].sort((a, b) => {
      if (a.included() !== b.included()) {
        return a.included() ? -1 : 1;
      }
      const dateA = a.entryDate()?.getTime() || Infinity;
      const dateB = b.entryDate()?.getTime() || Infinity;
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return a.id.localeCompare(b.id);
    });
  });

  public setResources(interactionManager: MapInteractionManager, marker: Marker) {
    this.interactionManager = interactionManager;
    this._marker.set(marker);
  }

  uiService = inject(UiService);
  tripService = inject(TripService);

  getBookingStatus(visit: Visit) {
    // TODO implement.
    return 'paid';
  }

  async handleVisitClick(event: MouseEvent, visit: Visit) {
    event.stopPropagation();
    const state = this.uiService.drawingState();

    console.log('clicked visit, drawing state:', state.active);

    if (!state.active) {
      // Normal behavior: Open popup
      const marker = this.marker();
      if (marker) {
        this.interactionManager.handleOpenVisitPopup(visit, marker);
        if (this.uiService.isSearchExpanded()) {
          this.uiService.closeSearch();
        }
      }
      return;
    }

    // --- DRAWING MODE ACTIVE ---
    const point = { x: event.clientX, y: event.clientY };
    if (visit.id === state.sourceVisit?.id) return;
    if (state.preselectedRoute && (state.preselectedRoute?.target === visit.place)) {
      const sourceId = state.sourceVisit?.id;
      if (!sourceId) return;
      const existingOutgoingTraverses = this.tripService.plan()?.visits().get(sourceId)?.outgoingTraverses();
      const priority = (existingOutgoingTraverses && existingOutgoingTraverses.length) ? existingOutgoingTraverses[0].priority() : 0;
      this.tripService.addTraverse(sourceId, visit.id, state.preselectedRoute.id, priority).pipe(take(1)).subscribe({
        next: (newTraverse) => {
          console.log('Added traverse successfully in the server');
        },
        error: (err) => {
          // Note: If your 'persist' method already shows a toast/alert,
          // you might not even need this block!
          console.error("Failed to add traverse:", err);
        }
      });
      this.interactionManager.cancelDrawing();
    } else {
      this.uiService.drawingState.update(s => ({ ...s, targetVisit: visit }));
      await this.interactionManager.showRouteTypeSelector(point);
    }
  }

  handleAddClick(event: MouseEvent): void {
    event.stopPropagation();
    //TODO check for drawing mode.
    console.log('Add new visit.')
    this.tripService.addVisit(this.place().id).pipe(take(1)).subscribe({
      next: (newVisit) => {
        const marker = this.marker();
        if (marker && newVisit) {
          this.interactionManager.handleOpenVisitPopup(newVisit, marker);
        }
      },
      error: (err) => {
        // Note: If your 'persist' method already shows a toast/alert,
        // you might not even need this block!
        console.error("Failed to add visit:", err);
      }
    });
  }

  @HostListener('mouseenter', ['$event'])
  onHover(event: MouseEvent) {
    event.stopPropagation();
    this.interactionManager.handleMarkerHover(this.place(), this.marker());
  }

  @HostListener('mouseleave')
  onUnhover() {
    this.interactionManager.handleMarkerUnhover();
  }
}
