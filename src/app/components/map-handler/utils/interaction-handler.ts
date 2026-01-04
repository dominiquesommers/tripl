import {TripService} from '../../../services/trip';
import {UiService} from '../../../services/ui';
import type { Map as MapboxMap, GeoJSONSource, LngLatLike, Marker, Popup } from 'mapbox-gl';
import {Place} from '../../../models/place';
import {WritableSignal} from '@angular/core';
import {Route} from '../../../models/route';

export class MapInteractionManager {
  private activePlacePopup?: mapboxgl.Popup;
  private hoverTimer?: any;
  private placeHoverPopup?: any;
  private routeHoverPopup?: any;

  constructor(
    private map: MapboxMap,
    private mapbox: any,
    private tripService: TripService,
    private uiService: UiService,
    private activePlacePopupEL: HTMLElement,
    private placeTooltipEl: HTMLElement,
    private routeTooltipEl: HTMLElement,
    private hoveredPlace: WritableSignal<Place | null>,
    private hoveredRoute: WritableSignal<Route | null>
  ) {}

  public attachGlobalListeners(centerSignal: any, zoomSignal: any) {
    this.map.on('click', () => {
      this.tripService.selectedPlace.set(null);
      if (this.uiService.isSearchExpanded()) this.uiService.closeSearch();
    });

    this.map.on('move', () => {
      const center = this.map.getCenter();
      centerSignal.set([center.lng, center.lat]);
      zoomSignal.set(this.map.getZoom());
    });
  }

  public wireMarker(place: Place, marker: Marker, element: HTMLElement) {
    element.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();

      // 1. Handle the popup logic
      this.handleOpenPopup(place, marker);

      // 2. Handle search state
      if (this.uiService.isSearchExpanded()) {
        this.uiService.closeSearch();
      }
    });
  }

  private handleOpenPopup(place: Place, marker: Marker) {
    this.tripService.selectedPlace.set(place);
    this.showActivePlacePopup(marker.getLngLat());
  }

  public showActivePlacePopup(lngLat: LngLatLike) {
    if (this.activePlacePopup) {
      this.activePlacePopup.remove();
    }
    setTimeout(() => {
      this.activePlacePopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      })
      .setDOMContent(this.activePlacePopupEL)
      .setLngLat(lngLat)
      .addTo(this.map);

      // 3. Handle cleanup if the user closes the popup via Mapbox controls
      this.activePlacePopup?.on('close', () => {
        this.tripService.selectedPlace.set(null);
        this.activePlacePopup = undefined;
      });
    }, 0);
  }

  public closeActivePopup() {
    if (this.activePlacePopup) {
      this.activePlacePopup.remove();
      this.activePlacePopup = undefined;
      this.tripService.selectedPlace.set(null);
    }
  }

  public handleMarkerHover(place: Place) {
    this.clearTimers();

    // Don't show tooltip if a place is already selected/clicked
    if (this.tripService.selectedPlace()) return;

    this.hoverTimer = setTimeout(() => {
      this.hoveredPlace.set(place);

      if (!this.placeHoverPopup) {
        this.placeHoverPopup = new this.mapbox.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: 'hover-tooltip'
        });
      }

      this.placeHoverPopup
        .setLngLat([place.lng, place.lat])
        .setDOMContent(this.placeTooltipEl)
        .addTo(this.map);
    }, 120);
  }

  public handleMarkerUnhover() {
    this.clearTimers();
    this.hoveredPlace.set(null);
    this.placeHoverPopup?.remove();
  }

  public attachLayerListeners() {
    this.map.on('mouseenter', ['route-icons'], (e) => {
      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;

      this.map.getCanvas().style.cursor = 'pointer';
      this.clearTimers();

      this.hoverTimer = setTimeout(() => {
        const route = this.tripService.trip()?.routes()?.get(routeId);
        this.hoveredRoute.set(route ?? null);

        this.map.setFeatureState(
          { source: 'all-routes', id: featureId },
          { hover: true }
        );

        if (!this.routeHoverPopup) {
          this.routeHoverPopup = new this.mapbox.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
            className: 'hover-tooltip'
          });
        }

        this.routeHoverPopup
          .setLngLat(e.lngLat)
          .setDOMContent(this.routeTooltipEl)
          .addTo(this.map);
      }, 120);
    });

    this.map.on('mouseleave', ['route-icons'], () => {
      this.hoveredRoute.set(null);
      this.routeHoverPopup?.remove();
      this.map.getCanvas().style.cursor = '';
      this.clearTimers();
      this.map.removeFeatureState({ source: 'all-routes' });
    });
  }

  private clearTimers() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = undefined;
    }
  }

  public destroy() {
    this.clearTimers();
    this.placeHoverPopup?.remove();
    this.routeHoverPopup?.remove();
  }
}
