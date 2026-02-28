import {TripService} from '../../../services/trip';
import {UiService} from '../../../services/ui';
import type {Map as MapboxMap, GeoJSONSource, LngLatLike, Marker, Popup} from 'mapbox-gl';
import {Place} from '../../../models/place';
import {
  effect,
  ElementRef,
  Injector,
  runInInjectionContext,
  Signal,
  WritableSignal
} from '@angular/core';
import {Route, RouteType} from '../../../models/route';
import {Visit} from '../../../models/visit';
import {filter, of, switchMap, take} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';


export class MapInteractionManager {
  private activeVisitPopup?: Popup;
  private activeRoutePopup?: Popup;
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
        const visit = this.uiService.selectedVisit();
        const popupElement = this.activeVisitPopupEL();
        if (visit && popupElement) {
          console.log('wiheoe');
          const coords: [number, number] = [visit.place.lng, visit.place.lat];
          this.syncVisitPopup(visit, popupElement, coords);
          onCleanup(() => {
            this.closeActiveVisitPopup();
          });
        } else if (popupElement) {
          this.closeActiveVisitPopup();
        }
      });

      effect(() => {
        const route = this.uiService.selectedRoute();
        const popupElement = this.activeRoutePopupEL();
        this.syncRoutePopup(route, popupElement);
      });

      effect((onCleanup) => {
        const hoveredRoute = this.uiService.hoveredRoute();
        const routeToCleanup = hoveredRoute;
        if (hoveredRoute) {
          this.handleRouteHover(hoveredRoute);
          onCleanup(() => {
            this.handleRouteUnhover(routeToCleanup);
          });
        }
      });

      effect(() => {
        const plan = this.tripService.plan();
        if (!plan || !map) return;
        this.map.flyTo({center: [plan.lat(), plan.lng()], zoom: plan.zoom(), essential: true});
      });

      this.uiService.flyToRequested$
        .pipe(takeUntilDestroyed())
        .subscribe(request => {
          if (!this.map) return;
          this.map.flyTo({
            center: request.center, zoom: request.zoom ?? this.map.getZoom(), essential: true, duration: 2000
          });
        });
    });
  }

  public attachGlobalListeners(centerSignal: any, zoomSignal: any) {
    this.map.on('click', (e) => {
      if ((e.originalEvent as any)._routeClicked) return;

      if (!this.uiService.drawingState().active) {
        this.uiService.clearSelection();
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
    this.uiService.selectVisit(visit.id);
    this.handleMarkerUnhover();
  }

  private syncVisitPopup(visit: Visit, popupElement: ElementRef, coords: [number, number]) {
    if (this.activeVisitPopup) {
       this.activeVisitPopup.setLngLat(coords);
       return;
    }
    this.activeVisitPopup = new this.mapbox.Popup({
      maxWidth: '320px',
      offset: 15,
      closeButton: false,
      className: 'apple-glass-popup'
    }).setDOMContent(popupElement.nativeElement)
      .setLngLat(coords)
      .addTo(this.map);
    this.activeVisitPopup?.on('close', () => {
      if (this.uiService.selectedVisit() === visit) {
        this.uiService.clearSelection();
        this.handleMarkerUnhover();
      }
      this.activeVisitPopup = undefined;
    });
  }

  private syncRoutePopup(route: Route | null, popupElement: ElementRef | undefined) {
    if (route && popupElement) {
      if (this.activeVisitPopup && route.popupCoords) {
         this.activeVisitPopup.setLngLat(route.popupCoords);
         return;
      }
      this.activeRoutePopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      })
      .setDOMContent(popupElement.nativeElement)
      .setLngLat(route.popupCoords)
      .addTo(this.map);

      this.activeRoutePopup?.on('close', () => {
        if (this.uiService.selectedRoute() === route) {
          this.uiService.clearSelection();
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
      this.handleMarkerUnhover();
    }
  }

  public closeActiveRoutePopup() {
    if (this.activeRoutePopup) {
      this.activeRoutePopup.remove();
      this.activeRoutePopup = undefined;
      this.uiService.clearSelection();
    }
  }

  public handleMarkerHover(place: Place, marker: Marker | null) {
    this.clearTimers();
    // Don't show tooltip if a place is already selected/clicked
    if (this.uiService.selectedVisit() || this.uiService.selectedRoute()) return;
    this.uiService.hoveredPlace.set(place);
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
    this.uiService.hoveredPlace.set(null);
    this.placeTooltip?.remove();
    if (!this.uiService.selectedVisit()) {
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
      if (!element || this.uiService.selectedVisit() || this.uiService.selectedRoute()) return;

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
    this.map.getCanvas().style.cursor = (this.uiService.drawingState().active) ? 'crosshair' : '';
    this.clearTimers();
  }

  public attachLayerListeners() {
    this.map.on('click', ['route-icons'], (e) => {
      (e.originalEvent as any)._routeClicked = true;

      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      console.log('route icon clicked.', routeId, featureId);
      if (!routeId || featureId === undefined) return;
      const route = this.tripService.trip()?.routes()?.get(routeId);
      console.log('select.', route, this.uiService.drawingState().active);
      if (!this.uiService.drawingState().active) {
        this.uiService.selectRoute(route?.id ?? null, e.lngLat);
        console.log(this.uiService.selectedRoute());
      } else if (route) {
        const targetPlace = route?.target;
        if (targetPlace && (this.uiService.drawingState().sourceVisit?.place === route?.source)) {
          this.uiService.drawingState.update(s => ({...s, preselectedRoute: route}));
          const drawingSource = this.map.getSource('drawing-line') as mapboxgl.GeoJSONSource;
          if (drawingSource) drawingSource.setData({ type: 'FeatureCollection', features: [] });
          this.map.getCanvas().style.cursor = 'pointer';
          console.log('flying to target, drawing state:', this.uiService.drawingState().active)
          this.map.flyTo({center: [targetPlace.lng, targetPlace.lat], zoom: Math.max(this.map.getZoom(), 7), essential: true});
          this.toggleMapInteractions(false);
        }
      }
    });

    this.map.on('mouseenter', ['route-icons'], (e) => {
      if (this.uiService.hoveredPlace()) return;
      const feature = e.features?.[0];
      const routeId = feature?.properties?.['routeId'];
      const featureId = feature?.id;

      if (!routeId || featureId === undefined) return;
      this.map.getCanvas().style.cursor = 'pointer';
      this.clearTimers();
      const route = this.tripService.trip()?.routes()?.get(routeId);
      this.uiService.hoveredRoute.set(route ?? null);
      this.currentRouteTooltipCoords = e.lngLat;
    });

    this.map.on('mouseleave', ['route-icons'], () => {
      this.uiService.hoveredRoute.set(null);
      this.currentRouteTooltipCoords = null;
    });

    this.map.on('mousemove', (e) => {
      const state = this.uiService.drawingState();
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
    const sourcePlace = this.uiService.drawingState().sourceVisit?.place;
    const targetPlace = this.uiService.drawingState().targetVisit?.place;
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
    const {sourceVisit, targetVisit} = this.uiService.drawingState();
    const trip = this.tripService.trip();
    if (!sourceVisit || !targetVisit || !trip) return this.cancelDrawing();
    // 1. Look for existing objects
    const existingRoute = trip.routesArray()?.find(
      r => r.sourceId === sourceVisit.place_id && r.targetId === targetVisit.place_id && r.type() === type
    );
    const existingTraverse = sourceVisit.outgoingTraverses().find(t => t.route_id === existingRoute?.id);
    // 2. Scenario A: Traverse already exists - just boost priority
    if (existingRoute && existingTraverse) {
      const topTraverse = sourceVisit.outgoingTraverses()[0];
      if (topTraverse.id !== existingTraverse.id) {
        this.tripService.updateTraverse(existingTraverse.id, {priority: topTraverse.priority() - 1}).subscribe();
      }
    }
    // 3. Scenario B: Route/Traverse creation
    else {
      const nextPriority = (sourceVisit.outgoingTraverses()[0]?.priority() ?? 1) - 1;
      const route$ = existingRoute
        ? of(existingRoute)
        : this.tripService.addRoute(sourceVisit.place_id, targetVisit.place_id, type);

      route$.pipe(
        filter((route): route is Route => !!route), // Ensure we have a route
        switchMap(route =>
          this.tripService.addTraverse(sourceVisit.id, targetVisit.id, route.id, nextPriority)
        ),
        take(1)
      ).subscribe({
        next: () => console.log('Successfully added/linked traverse'),
        error: (err) => console.error('Flow failed:', err)
      });
    }

    this.cancelDrawing();
  }

  cancelDrawing() {
    // If the selector was open, resolve the promise so the 'await' finishes
    console.log('CLEARING RESOLVER (CANCEL)');
    if (this.selectionResolver) {
      this.selectionResolver(null);
      this.selectionResolver = null;
    }

    this.uiService.drawingState.set({ active: false, sourceVisit: null });
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
