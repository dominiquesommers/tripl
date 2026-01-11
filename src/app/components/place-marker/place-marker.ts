import {Component, computed, HostListener, inject, input, Input, signal, Signal, ElementRef} from '@angular/core';
import {NewVisit, Visit} from '../../models/visit';
import {Place} from '../../models/place';
import {MapInteractionManager} from '../map-handler/utils/interaction-handler';
import {Marker} from 'mapbox-gl';
import {UiService} from '../../services/ui';
import {TripService} from '../../services/trip';
import {RouteType} from '../../models/route';

@Component({
  selector: 'app-place-marker',
  imports: [],
  templateUrl: './place-marker.html',
  styleUrl: './place-marker.css',
})
export class PlaceMarker {
  public elementRef = inject(ElementRef);

  place = input.required<Place>();
  @Input() hoveredPlace!: Signal<Place | null>;
  readonly isHovered = computed(() => this.place() === this.hoveredPlace());
  @Input() selectedVisit!: Signal<Visit | null>;
  readonly isSelected = computed(() => this.place() === this.selectedVisit()?.place);
  zoom = input.required<Signal<number>>();
  readonly isZoomLow = computed(() => this.zoom()() < 3);
  public interactionManager!: MapInteractionManager;
  private _marker = signal<Marker | null>(null);
  public marker = this._marker.asReadonly();

  public setResources(interactionManager: MapInteractionManager, marker: Marker) {
    this.interactionManager = interactionManager;
    this._marker.set(marker);
  }

  private uiService = inject(UiService);
  private tripService = inject(TripService);

  async handleVisitClick(event: MouseEvent, visit: Visit) {
    event.stopPropagation();
    const state = this.tripService.drawingState();

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
      await this.tripService.createTraverse(state.preselectedRoute.type(), state.sourceVisit?.id, visit.id);
      this.interactionManager.cancelDrawing();
    } else {
      this.tripService.drawingState.update(s => ({ ...s, targetVisit: visit }));
      await this.interactionManager.showRouteTypeSelector(point);
    }
  }

  async handleAddClick(event: MouseEvent) {
    event.stopPropagation();
    //TODO check for drawing mode.
    console.log('Add new visit.')
    try {
      const plan = this.tripService.plan();
      if (!plan) return;
      const newVisitData: NewVisit = {place_id: this.place().id, plan_id: plan.id, nights: 0, included: true};
      const newVisit = await this.tripService.addVisit(newVisitData);
      const marker = this.marker();
      if (marker && newVisit) {
        this.interactionManager.handleOpenVisitPopup(newVisit, marker);
      }
    } catch (err) {
      console.error("Failed to add visit:", err);
    }
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
