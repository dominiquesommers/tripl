import {TripService} from '../../../services/trip';
import {UiService} from '../../../services/ui';
import type { Map as MapboxMap, GeoJSONSource, LngLatLike, Marker, Popup } from 'mapbox-gl';
import {Place} from '../../../models/place';
import {effect, ElementRef, Injector, runInInjectionContext, Signal, WritableSignal} from '@angular/core';
import {Route} from '../../../models/route';
import {Visit} from '../../../models/visit';


export class MapInteractionManager {
  private activeVisitPopup?: Popup;
  currentVisitPopupCoords?: LngLatLike;
  private activeRoutePopup?: Popup;
  currentRoutePopupCoords?: LngLatLike;
  private hoverTimer?: any;
  private placeTooltip?: any;
  private hoveredMarker?: Marker | null;
  private routeTooltip?: any;
  private currentRouteTooltipCoords?: LngLatLike | null;

  constructor(
    private map: MapboxMap,
    private mapbox: any,
    private tripService: TripService,
    private uiService: UiService,
    private activeVisitPopupEL: Signal<ElementRef | undefined>,
    private activeRoutePopupEL: Signal<ElementRef | undefined>,
    private placeTooltipEl: Signal<ElementRef | undefined>,
    private routeTooltipEl: Signal<ElementRef | undefined>,
    private injector: Injector
  ) {
    runInInjectionContext(this.injector, () => {
      effect((onCleanup) => {
        const visit = this.tripService.selectedVisit();
        const popupElement = this.activeVisitPopupEL();
        if (visit && popupElement) {
          this.syncVisitPopup(visit, popupElement);
          onCleanup(() => {
            // this.closeActiveVisitPopup();
            // TODO fix.
          });
        }
      });

      effect(() => {
        const route = this.tripService.selectedRoute();
        const popupElement = this.activeRoutePopupEL();
        this.syncRoutePopup(route, popupElement);
      });

      effect((onCleanup) => {
        const hoveredRoute = this.tripService.hoveredRoute();
        if (hoveredRoute) {
          this.handleRouteHover(hoveredRoute);
          onCleanup(() => {
            this.handleRouteUnhover();
          });
        }
      });
    });
  }

  public attachGlobalListeners(centerSignal: any, zoomSignal: any) {
    this.map.on('click', () => {
      this.tripService.selectedVisit.set(null);
      this.tripService.selectedRoute.set(null);
      if (this.uiService.isSearchExpanded()) this.uiService.closeSearch();
    });

    this.map.on('move', () => {
      const center = this.map.getCenter();
      centerSignal.set([center.lng, center.lat]);
      zoomSignal.set(this.map.getZoom());
    });
  }

  public handleOpenVisitPopup(visit: Visit, marker: Marker) {
    this.tripService.selectedVisit.set(visit);
    this.currentVisitPopupCoords = marker.getLngLat();
    this.handleMarkerUnhover();
  }

  private syncVisitPopup(visit: Visit, popupElement: ElementRef) {
    if (this.currentVisitPopupCoords) {
      if (this.activeVisitPopup) {
         this.activeVisitPopup.setLngLat(this.currentVisitPopupCoords);
         return;
      }
      this.activeVisitPopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      }).setDOMContent(popupElement.nativeElement)
        .setLngLat(this.currentVisitPopupCoords)
        .addTo(this.map);
      this.activeVisitPopup?.on('close', () => {
        if (this.tripService.selectedVisit() === visit) {
          this.tripService.selectedVisit.set(null);
          this.handleMarkerUnhover();
        }
        this.activeVisitPopup = undefined;
      });
    }
  }

  private syncRoutePopup(route: Route | null, popupElement: ElementRef | undefined) {
    if (route && popupElement && this.currentRoutePopupCoords) {
      if (this.activeVisitPopup) {
         this.activeVisitPopup.setLngLat(this.currentRoutePopupCoords);
         return;
      }
      this.activeRoutePopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      })
      .setDOMContent(popupElement.nativeElement)
      .setLngLat(this.currentRoutePopupCoords)
      .addTo(this.map);

      this.activeRoutePopup?.on('close', () => {
        if (this.tripService.selectedRoute() === route) {
          this.tripService.selectedRoute.set(null);
        }
        this.activeRoutePopup = undefined;
      });
    }
  }

  public closeActiveVisitPopup() {
    if (this.activeVisitPopup) {
      console.log('close visit popup.')
      this.activeVisitPopup.remove();
      this.activeVisitPopup = undefined;
      this.tripService.selectedVisit.set(null);
      this.handleMarkerUnhover();
    }
  }

  public closeActiveRoutePopup() {
    if (this.activeRoutePopup) {
      this.activeRoutePopup.remove();
      this.activeRoutePopup = undefined;
      this.tripService.selectedRoute.set(null);
    }
  }

  public handleMarkerHover(place: Place, marker: Marker | null) {
    this.clearTimers();
    // Don't show tooltip if a place is already selected/clicked
    if (this.tripService.selectedVisit() || this.tripService.selectedRoute()) return;
    this.tripService.hoveredPlace.set(place);
    this.hoveredMarker = marker;
    if (place.visits()?.length > 0) {
      this.hoveredMarker?.setOffset([10, 0]);
    }

    this.hoverTimer = setTimeout(() => {
      const element = this.placeTooltipEl();
      if (!element) return;
      // this.marker.setOffset([0, 0]);
      if (!this.placeTooltip) {
        this.placeTooltip = new this.mapbox.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: 'hover-tooltip'
        });
      }
      this.placeTooltip
        .setLngLat([place.lng, place.lat])
        .setDOMContent(element.nativeElement)
        .addTo(this.map);
    }, 120);
  }

  public handleMarkerUnhover(forceMarkerOffsetReset: boolean = false) {
    this.clearTimers();
    this.tripService.hoveredPlace.set(null);
    this.placeTooltip?.remove();
    if (!this.tripService.selectedVisit()) {
      this.hoveredMarker?.setOffset([0, 0]);
    }
  }

  public handleRouteHover(route: Route) {
    this.hoverTimer = setTimeout(() => {
      this.map.setFeatureState(
        { source: 'all-routes', id: route.id },
        { hover: true }
      );

      const element = this.routeTooltipEl();
      if (!element || this.tripService.selectedVisit() || this.tripService.selectedRoute()) return;

      if (!this.routeTooltip) {
        this.routeTooltip = new this.mapbox.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: 'hover-tooltip'
        });
      }

      if (this.currentRouteTooltipCoords) {
        this.routeTooltip
          .setLngLat(this.currentRouteTooltipCoords)
          .setDOMContent(element.nativeElement)
          .addTo(this.map);
      }
    }, 120);
  }

  public handleRouteUnhover() {
    this.routeTooltip?.remove();
    this.map.getCanvas().style.cursor = '';
    this.clearTimers();
    if (this.map.getSource('all-routes')) {
      this.map.removeFeatureState({ source: 'all-routes' });
    }
  }

  public attachLayerListeners() {
    this.map.on('click', ['route-icons'], (e) => {
      // if (this.tripService.selectedVisit()) return;
      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;
      const route = this.tripService.trip()?.routes()?.get(routeId);
      this.tripService.selectedRoute.set(route ?? null);
      this.currentRoutePopupCoords = e.lngLat;
    });

    this.map.on('mouseenter', ['route-icons'], (e) => {
      if (this.tripService.hoveredPlace()) return;
      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;
      this.map.getCanvas().style.cursor = 'pointer';
      this.clearTimers();
      const route = this.tripService.trip()?.routes()?.get(routeId);
      this.tripService.hoveredRoute.set(route ?? null);
      this.currentRouteTooltipCoords = e.lngLat;
    });

    this.map.on('mouseleave', ['route-icons'], () => {
      this.tripService.hoveredRoute.set(null);
      this.currentRouteTooltipCoords = null;
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
    this.placeTooltip?.remove();
    this.routeTooltip?.remove();
  }
}
