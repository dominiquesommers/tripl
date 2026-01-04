import {TripService} from '../../../services/trip';
import {UiService} from '../../../services/ui';
import type { Map as MapboxMap, GeoJSONSource, LngLatLike, Marker, Popup } from 'mapbox-gl';
import {Place} from '../../../models/place';
import {ElementRef, Signal, WritableSignal} from '@angular/core';
import {Route} from '../../../models/route';


export class MapInteractionManager {
  private activePlacePopup?: Popup;
  private activeRoutePopup?: Popup;
  private hoverTimer?: any;
  private placeHoverPopup?: any;
  private routeHoverPopup?: any;

  constructor(
    private map: MapboxMap,
    private mapbox: any,
    private tripService: TripService,
    private uiService: UiService,
    private activePlacePopupEL: Signal<ElementRef | undefined>,
    private activeRoutePopupEL: Signal<ElementRef | undefined>,
    private placeTooltipEl: Signal<ElementRef | undefined>,
    private routeTooltipEl: Signal<ElementRef | undefined>,
    private hoveredPlace: WritableSignal<Place | null>,
    private hoveredRoute: WritableSignal<Route | null>
  ) {}

  public attachGlobalListeners(centerSignal: any, zoomSignal: any) {
    this.map.on('click', () => {
      this.tripService.selectedPlace.set(null);
      this.tripService.selectedRoute.set(null);
      if (this.uiService.isSearchExpanded()) this.uiService.closeSearch();
    });

    this.map.on('move', () => {
      const center = this.map.getCenter();
      centerSignal.set([center.lng, center.lat]);
      zoomSignal.set(this.map.getZoom());
    });
  }

  public handleOpenPlacePopup(place: Place, marker: Marker) {
    this.tripService.selectedPlace.set(place);
    this.showActivePlacePopup(marker.getLngLat());
  }

  public showActivePlacePopup(lngLat: LngLatLike) {
    if (this.activePlacePopup) {
      this.activePlacePopup.remove();
    }
    // TODO we can 'listen' to the this.activePlacePopupEL signal, then the timeout is unnecessary.
    setTimeout(() => {
      const element = this.activePlacePopupEL()
      if (!element) return;
      this.activePlacePopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      })
      .setDOMContent(element.nativeElement)
      .setLngLat(lngLat)
      .addTo(this.map);

      // 3. Handle cleanup if the user closes the popup via Mapbox controls
      this.activePlacePopup?.on('close', () => {
        this.tripService.selectedPlace.set(null);
        this.activePlacePopup = undefined;
      });
    }, 0);
  }

  public showActiveRoutePopup(lngLat: LngLatLike) {
    if (this.activeRoutePopup) {
      this.activeRoutePopup.remove();
    }
    // TODO we can 'listen' to the this.activePlacePopupEL signal, then the timeout is unnecessary.
    setTimeout(() => {
      const element = this.activeRoutePopupEL()
      if (!element) return;
      this.activeRoutePopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      })
      .setDOMContent(element.nativeElement)
      .setLngLat(lngLat)
      .addTo(this.map);

      // 3. Handle cleanup if the user closes the popup via Mapbox controls
      this.activeRoutePopup?.on('close', () => {
        this.tripService.selectedRoute.set(null);
        this.activeRoutePopup = undefined;
      });
    }, 0);
  }

  public closeActivePlacePopup() {
    if (this.activePlacePopup) {
      this.activePlacePopup.remove();
      this.activePlacePopup = undefined;
      this.tripService.selectedPlace.set(null);
    }
  }

  public closeActiveRoutePopup() {
    if (this.activeRoutePopup) {
      this.activeRoutePopup.remove();
      this.activeRoutePopup = undefined;
      this.tripService.selectedRoute.set(null);
    }
  }

  public handleMarkerHover(place: Place) {
    this.clearTimers();

    // Don't show tooltip if a place is already selected/clicked
    if (this.tripService.selectedPlace()) return;
    this.hoveredPlace.set(place);

    this.hoverTimer = setTimeout(() => {
      const element = this.placeTooltipEl();
      if (!element) return;
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
        .setDOMContent(element.nativeElement)
        .addTo(this.map);
    }, 120);
  }

  public handleMarkerUnhover() {
    this.clearTimers();
    this.hoveredPlace.set(null);
    this.placeHoverPopup?.remove();
  }

  public attachLayerListeners() {
    this.map.on('click', ['route-icons'], (e) => {
      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;
      const route = this.tripService.trip()?.routes()?.get(routeId);
      this.tripService.selectedRoute.set(route ?? null);
      this.showActiveRoutePopup(e.lngLat);
    });

    this.map.on('mouseenter', ['route-icons'], (e) => {
      if (this.tripService.selectedPlace()) return;

      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;

      this.map.getCanvas().style.cursor = 'pointer';
      this.clearTimers();

      const route = this.tripService.trip()?.routes()?.get(routeId);
      this.hoveredRoute.set(route ?? null);

      this.hoverTimer = setTimeout(() => {
        const element = this.routeTooltipEl();
        if (!element) return;

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
          .setDOMContent(element.nativeElement)
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
