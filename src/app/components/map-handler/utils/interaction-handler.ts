import {TripService} from '../../../services/trip';
import {UiService} from '../../../services/ui';
import type {Map as MapboxMap, GeoJSONSource, LngLatLike, Marker, Popup, Point} from 'mapbox-gl';
import {Place} from '../../../models/place';
import {
  effect,
  ElementRef,
  HostListener,
  Injector,
  runInInjectionContext,
  signal,
  Signal,
  WritableSignal
} from '@angular/core';
import {Route, RouteType} from '../../../models/route';
import {Visit} from '../../../models/visit';
import {MapHandler} from '../map-handler';


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

  private selectionResolver: ((type: RouteType | null) => void) | null = null;

  constructor(
    private map: MapboxMap,
    private mapbox: any,
    private tripService: TripService,
    private uiService: UiService,
    private activeVisitPopupEL: Signal<ElementRef | undefined>,
    private activeRoutePopupEL: Signal<ElementRef | undefined>,
    private placeTooltipEl: Signal<ElementRef | undefined>,
    private routeTooltipEl: Signal<ElementRef | undefined>,
    private selectorVisible: WritableSignal<boolean>,
    private selectorPos: WritableSignal<{ x: number, y: number }>,
    private injector: Injector
  ) {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const plan = this.tripService.plan();
        // const itineraryTraverses = plan?.visitsArray()
        //   .map(visit => visit.nextTraverse())
        //   .filter(traverse => !!traverse) ?? [];
        const itineraryTraverses = plan?.itineraryTraverses() ?? [];
        const itineraryRouteIds = new Set(itineraryTraverses.map(traverse => traverse.route?.id));
        const map = this.map;
        if (!map) return;
        // TODO check if the timeout can be avoided.
        setTimeout(() => {
          if (!map.getSource('all-routes')) return;
          const allRoutes = this.tripService.trip()?.routes() ?? new Map();
          allRoutes.forEach((route, id) => {
            const isActive = itineraryRouteIds.has(id);
            map.setFeatureState(
              { source: 'all-routes', id: id },
              { disabled: !isActive }
            );
          });
        }, 500);
      });

      effect((onCleanup) => {
        const visit = this.tripService.selectedVisit();
        const popupElement = this.activeVisitPopupEL();
        if (visit && popupElement) {
          this.syncVisitPopup(visit, popupElement);
          onCleanup(() => {
            this.closeActiveVisitPopup();
          });
        } else if (popupElement) {
          this.closeActiveVisitPopup();
        }
      });

      effect(() => {
        const route = this.tripService.selectedRoute();
        const popupElement = this.activeRoutePopupEL();
        this.syncRoutePopup(route, popupElement);
      });

      effect((onCleanup) => {
        const hoveredRoute = this.tripService.hoveredRoute();
        const routeToCleanup = hoveredRoute;
        if (hoveredRoute) {
          this.handleRouteHover(hoveredRoute);
          onCleanup(() => {
            this.handleRouteUnhover(routeToCleanup);
          });
        }
      });
    });
  }

  public attachGlobalListeners(centerSignal: any, zoomSignal: any) {
    this.map.on('click', (e) => {
      if (!this.tripService.drawingState().active) {
        this.tripService.selectedVisit.set(null);
        this.tripService.selectedRoute.set(null);
        if (this.uiService.isSearchExpanded()) this.uiService.closeSearch();
      } else {
        const features = this.map.queryRenderedFeatures(e.point, {layers: ['route-icons']});
        if (features.length === 0) {
          console.log('cancel drawing mode from map click not on a route icon.')
          this.cancelDrawing();
        }
      }
    });

    this.map.on('move', () => {
      const center = this.map.getCenter();
      centerSignal.set([center.lng, center.lat]);
      zoomSignal.set(this.map.getZoom());
    });
  }

  private toggleMapInteractions(enabled: boolean) {
    const handlers = [
      this.map.scrollZoom,
      this.map.boxZoom,
      this.map.dragPan,
      this.map.dragRotate,
      this.map.keyboard,
      this.map.doubleClickZoom,
      this.map.touchZoomRotate
    ];

    handlers.forEach(handler => {
      if (enabled) handler.enable();
      else handler.disable();
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
        maxWidth: '320px',
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
      // this.tripService.selectedVisit.set(null);
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
      this.hoveredMarker?.setOffset([8, 0]);
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

  public handleRouteUnhover(route: Route | null) {
    const routeId = route?.id;
    if (routeId) {
      this.map.setFeatureState(
        { source: 'all-routes', id: routeId },
        { hover: false }
      );
    }
    this.routeTooltip?.remove();
    this.map.getCanvas().style.cursor = (this.tripService.drawingState().active) ? 'crosshair' : '';
    this.clearTimers();
  }

  public attachLayerListeners() {
    this.map.on('click', ['route-icons'], (e) => {
      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;
      const route = this.tripService.trip()?.routes()?.get(routeId);

      if (!this.tripService.drawingState()) {
        this.tripService.selectedRoute.set(route ?? null);
        this.currentRoutePopupCoords = e.lngLat;
      } else if (route) {
        const targetPlace = route?.target;
        if (targetPlace && (this.tripService.drawingState().sourceVisit?.place === route?.source)) {
          this.tripService.drawingState.update(s => ({...s, preselectedRoute: route}));
          const drawingSource = this.map.getSource('drawing-line') as mapboxgl.GeoJSONSource;
          if (drawingSource) drawingSource.setData({ type: 'FeatureCollection', features: [] });
          this.map.getCanvas().style.cursor = 'pointer';
          console.log('flying to target, drawing state:', this.tripService.drawingState().active)
          this.map.flyTo({center: [targetPlace.lng, targetPlace.lat], zoom: Math.max(this.map.getZoom(), 7), essential: true});
          this.toggleMapInteractions(false);
        }
      }
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

    this.map.on('mousemove', (e) => {
      const state = this.tripService.drawingState();
      const sourcePlace = state.sourceVisit?.place;
      if (!state.active || !sourcePlace || state.preselectedRoute || this.selectorVisible()) return;

      const mousePos = [e.lngLat.lng, e.lngLat.lat];
      const source = this.map.getSource('drawing-line') as GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[sourcePlace.lng, sourcePlace.lat], mousePos]
          },
          properties: {}
        });
      }
    });
  }

  async showRouteTypeSelector(point: { x: number, y: number }) {
    const source = this.map.getSource('drawing-line') as GeoJSONSource;
    const sourcePlace = this.tripService.drawingState().sourceVisit?.place
    const targetPlace = this.tripService.drawingState().targetVisit?.place
    if (source && sourcePlace && targetPlace) {
      source.setData({ type: 'Feature', geometry: { type: 'LineString',
          coordinates: [[sourcePlace.lng, sourcePlace.lat], [targetPlace.lng, targetPlace.lat]]
        }, properties: {} });
    }
    this.selectorPos.set(point);
    this.selectorVisible.set(true);
    this.toggleMapInteractions(false);
  }

  handleTypeSelection(type: RouteType) {
    const state = this.tripService.drawingState();
    if (state.sourceVisit && state.targetVisit) {
      this.tripService.createTraverse(type, state.sourceVisit.id, state.targetVisit.id);
      this.cancelDrawing();
    }
  }

  cancelDrawing() {
    // If the selector was open, resolve the promise so the 'await' finishes
    console.log('CLEARING RESOLVER (CANCEL)');
    if (this.selectionResolver) {
      this.selectionResolver(null);
      this.selectionResolver = null;
    }

    this.tripService.drawingState.set({ active: false, sourceVisit: null });
    this.selectorVisible.set(false);
    this.toggleMapInteractions(true);
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
