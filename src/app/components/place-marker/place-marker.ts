import {Component, computed, HostListener, inject, input, Input, signal, Signal, ElementRef} from '@angular/core';
import { Visit } from '../../models/visit';
import {Place} from '../../models/place';
import {MapInteractionManager} from '../map-handler/utils/interaction-handler';
import {Marker} from 'mapbox-gl';
import {UiService} from '../../services/ui';

@Component({
  selector: 'app-place-marker',
  imports: [],
  templateUrl: './place-marker.html',
  styleUrl: './place-marker.css',
})
export class PlaceMarker {
  public elementRef = inject(ElementRef);

  place = input.required<Place>();
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

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent) {
    event.stopPropagation();
    const marker = this.marker();
    if (!marker) return;
    this.interactionManager.handleOpenPlacePopup(this.place(), marker);
    if (this.uiService.isSearchExpanded()) {
      this.uiService.closeSearch();
    }
  }

  @HostListener('mouseenter', ['$event'])
  onHover(event: MouseEvent) {
    event.stopPropagation();
    this.interactionManager.handleMarkerHover(this.place());
  }

  @HostListener('mouseleave')
  onUnhover() {
    this.interactionManager.handleMarkerUnhover();
  }
}
