import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  effect,
  Inject,
  ViewContainerRef, TemplateRef,
  ChangeDetectorRef, ViewChildren, QueryList, computed, HostListener, untracked, viewChildren, viewChild, Injector
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import {Overlay, OverlayRef} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { LucideAngularModule, Search } from 'lucide-angular';
import { AuthService } from '../../services/auth';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';
import {Place, UpdatePlace} from '../../models/place';
import { VisitPopup } from '../visit-popup/visit-popup';
import { PlaceMarker } from '../place-marker/place-marker';
import { PlaceTooltip } from '../place-tooltip/place-tooltip';
import { RouteTooltip } from '../route-tooltip/route-tooltip';
import type { Map as MapboxMap, GeoJSONSource, Marker, Popup } from 'mapbox-gl';
import {Route, RouteType} from '../../models/route';
import { environment } from '../../../environments/environment';
import {MapLayerManager} from './utils/layer-factory';
import {IconLoader} from './utils/icon-loader';
import {MapInteractionManager} from './utils/interaction-handler';

import {MAP_STYLES, INITIAL_CENTER, INITIAL_ZOOM, ROUTE_ICON_MAP, ROUTE_COLORS} from './config/map-styles.config';
import { MapSearch } from '../map-search/map-search';
import {RoutePopup} from '../route-popup/route-popup';
import {NotificationService} from '../../services/notification';
import { NavigationService } from '../../services/navigation';


@Component({
  selector: 'app-map',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, PlaceMarker, VisitPopup, RoutePopup, PlaceTooltip, RouteTooltip, LucideAngularModule, MapSearch],
  templateUrl: './map-handler.html',
  styleUrls: ['./map-handler.css']
})
export class MapHandler implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  readonly tripService = inject(TripService);
  readonly navigationService = inject(NavigationService);
  readonly uiService = inject(UiService);
  readonly notifierService = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  private mapbox: any;
  map = signal<MapboxMap | null>(null);
  center = signal<[number, number]>(INITIAL_CENTER);
  zoom = signal<number>(INITIAL_ZOOM);
  private layerManager!: MapLayerManager;
  interactionManager!: MapInteractionManager
  private iconLoader!: IconLoader;

  markerElements = viewChildren(PlaceMarker);
  mapContainer = viewChild.required<ElementRef>('mapContainer');
  visitPopupEl = viewChild(VisitPopup, {read: ElementRef});
  routePopupEl = viewChild(RoutePopup, {read: ElementRef});
  placeTooltipEl = viewChild(PlaceTooltip, { read: ElementRef });
  routeTooltipEl = viewChild(RouteTooltip, { read: ElementRef });
  selectorVisible = signal(false);
  selectorPos = signal({ x: 0, y: 0 });
  private selectedOffsetPlaceId: string | null = null;

  isMapVisible = signal(false);
  layersReady = signal(false);

  private static readonly PROGRESS_ALWAYS_GLOBE = 0.2;
  private static readonly PROGRESS_ALWAYS_MERCATOR = 0.5;
  private static readonly ZOOM_THRESHOLD_AT_HALF = 1;
  private static readonly ZOOM_HYSTERESIS = 0.1; // prevents flicker right at the boundary
  private currentProjection: 'globe' | 'mercator' = 'globe';
  private projectionFadeTimer?: ReturnType<typeof setTimeout>;

  private markers: Map<string, Marker> = new Map();
  private markerElementsById: Map<string, HTMLElement> = new Map();

  readonly availableTypes: RouteType[] = Object.keys(ROUTE_ICON_MAP) as RouteType[];

  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private routeSelectorTpl = viewChild<TemplateRef<unknown>>('routeSelectorTpl');
  private routeSelectorOverlayRef?: OverlayRef;

  constructor() {
    effect(() => this.syncUI());
    effect(() => this.syncTheme());
    effect(() => this.syncMarkers());
    effect(() => this.syncRoutes());
    effect(() => this.syncSelectedVisit());
    effect(() => this.syncDrawer());
    effect(() => {
    const visible = this.selectorVisible();
      const pos = this.selectorPos();
      if (visible) {
        this.openRouteSelector(pos);
      } else {
        this.routeSelectorOverlayRef?.dispose();
        this.routeSelectorOverlayRef = undefined;
      }
    });
  }

  private openRouteSelector(point: { x: number; y: number }) {
    this.routeSelectorOverlayRef?.dispose();

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(point)
      .withPositions([
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
      ])
      .withViewportMargin(4)
      .withPush(true);

    this.routeSelectorOverlayRef = this.overlay.create({
      positionStrategy,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });

    this.routeSelectorOverlayRef.backdropClick().subscribe(() => this.interactionManager.cancelDrawing());

    const tpl = this.routeSelectorTpl();
    if (tpl) this.routeSelectorOverlayRef.attach(new TemplatePortal(tpl, this.vcr));
  }

  @HostListener('window:visibilitychange', ['$event'])
  @HostListener('window:beforeunload', ['$event'])
  onPersistMapState(event?: Event) {
    const plan = this.tripService.plan();
    if (!plan) return;
    const hasMoved = plan.lat !== this.center()[0] || plan.lng !== this.center()[1] || plan.zoom !== this.zoom();
    if (hasMoved && (document.visibilityState === 'hidden' || event?.type === 'beforeunload')) {
      this.tripService.updatePlanSilently(plan.id, {
        lat: this.center()[0],
        lng: this.center()[1],
        zoom: this.zoom()
      });
    }
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.initializeMap();
    }
  }

  private computeInitialStyle(): string {
    const user = this.authService.user();
    const trip = this.tripService.trip();
    return trip ? MAP_STYLES.ACTIVE_TRIP : (user ? MAP_STYLES.LOGGED_IN : MAP_STYLES.LOGGED_OUT);
  }

  private async initializeMap() {
    console.log('Initialize map.')
    this.mapbox = (await import('mapbox-gl')).default;
    this.mapbox.accessToken = environment.mapboxToken;

    const map = new this.mapbox.Map({
      container: this.mapContainer().nativeElement,
      style: `mapbox://styles/mapbox/${this.computeInitialStyle()}`,
      center: this.center(),
      zoom: this.zoom(),
      config: { basemap: { lightPreset: 'night' } },
      logoPosition: 'bottom-right',
      attributionControl: false
    });

    map.on('load', () => {
     this.interactionManager = new MapInteractionManager(
       map, this.mapbox, this.tripService, this.uiService, this.notifierService, this.visitPopupEl, this.routePopupEl,
       this.placeTooltipEl, this.routeTooltipEl, this.selectorVisible, this.selectorPos, this.layersReady, this.injector
     );
     this.interactionManager.attachGlobalListeners(this.center, this.zoom);
    });

    map.on('style.load', async () => {
      this.layersReady.set(false);
      if (!this.iconLoader) this.iconLoader = new IconLoader(map);
      if (!this.layerManager) this.layerManager = new MapLayerManager(map, this.authService);
      if (!this.interactionManager) this.interactionManager = new MapInteractionManager(
        map, this.mapbox, this.tripService, this.uiService, this.notifierService, this.visitPopupEl, this.routePopupEl,
        this.placeTooltipEl, this.routeTooltipEl, this.selectorVisible, this.selectorPos, this.layersReady, this.injector
      );
      await this.iconLoader.loadRouteIcons();
      const currentData = untracked(() => this.tripService.trip()?.routesGeoJson());
      this.layerManager.initializeRouteLayers(currentData);
      this.interactionManager?.attachLayerListeners();
      this.layersReady.set(true);
      this.isMapVisible.set(true);
    });

    this.map.set(map);
  }

  private syncDrawer() {
    const state = this.uiService.drawingState();
    const isReady = this.layersReady();
    const map = this.map();
    if (!isReady || !map) return; // TODO handle via layerManager
    if (state.active) {
      map.getCanvas().style.cursor = 'crosshair';
      // Show the layer/source we'll use for drawing
      map.setLayoutProperty('drawing-line-layer', 'visibility', 'visible');
    } else {
      map.getCanvas().style.cursor = '';
      map.setLayoutProperty('drawing-line-layer', 'visibility', 'none');
      // Clear the line data
      const source = map.getSource('drawing-line') as GeoJSONSource;
      source?.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  private syncUI() {
    const isMobile = this.uiService.isMobile();
    const map = this.map();
    if (!map) return;

    if (isMobile) {
      const zoom = this.zoom();
      const progress = this.uiService.currentSheetProgress();
      if (progress <= 0.5) {
        const bottomPadding = progress < 0.1 ? 0 : this.uiService.currentSheetHeight();
        map.jumpTo({ padding: { bottom: bottomPadding } });
        this.syncProjection(progress);
      }
    } else {
      const leftPadding = this.uiService.sidePanelWidth();
      map.easeTo({ padding: { left: leftPadding }, duration: 500 });
    }
  }

  private syncProjection(progress: number) {
    const map = this.map();
    if (!map) return;
    const zoom = this.zoom();
    const threshold = this.zoomThresholdForProgress(progress);

    // hysteresis: require crossing threshold by a buffer before flipping,
    // so we don't rapidly toggle while zoom/progress sit right at the line
    const buffer = MapHandler.ZOOM_HYSTERESIS;
    const wantsMercator = this.currentProjection === 'mercator'
      ? zoom > threshold - buffer
      : zoom > threshold + buffer;

    const target: 'globe' | 'mercator' = wantsMercator ? 'mercator' : 'globe';
    if (target === this.currentProjection) return;

    this.currentProjection = target;
    this.fadeSwitchProjection(map, target);
  }

  private zoomThresholdForProgress(progress: number): number {
    const { PROGRESS_ALWAYS_GLOBE, PROGRESS_ALWAYS_MERCATOR, ZOOM_THRESHOLD_AT_HALF } = MapHandler;
    if (progress <= PROGRESS_ALWAYS_GLOBE) return Infinity;   // never switch below this
    if (progress > PROGRESS_ALWAYS_MERCATOR) return -Infinity; // always switch above this
    return ZOOM_THRESHOLD_AT_HALF;
  }

  private fadeSwitchProjection(map: mapboxgl.Map, target: 'globe' | 'mercator'): void {
    const container = map.getContainer();
    container.style.transition = 'opacity 150ms ease';
    container.style.opacity = '0';

    clearTimeout(this.projectionFadeTimer);
    this.projectionFadeTimer = setTimeout(() => {
      map.setProjection(target);
      requestAnimationFrame(() => {
        container.style.opacity = '1';
      });
    }, 150);
  }

  private syncTheme() {
    const offline = !this.authService.isOnline();
    const ready = this.layersReady();
    const user = this.authService.user();
    const trip = this.tripService.trip();

    const expectedTripId = this.tripService.navigationService.tripId();
    if (expectedTripId && !trip) return;

    const map = this.map();
    if (!map || !ready) return;

    const willChange = this.layerManager.currentStyle() !== this.layerManager.computeTargetStyle(user, trip);
    if (willChange) this.layersReady.set(false);
    this.layerManager.updateStyle(user, trip);
  }

  private syncSelectedVisit() {
    const selectedVisit = this.uiService.selectedVisit();
    const newPlaceId = selectedVisit?.place_id ?? null;

    if (this.selectedOffsetPlaceId && this.selectedOffsetPlaceId !== newPlaceId) {
      this.markers.get(this.selectedOffsetPlaceId)?.setOffset([0, 0]);
    }

    if (newPlaceId && (newPlaceId !== this.selectedOffsetPlaceId)) {
      const place = selectedVisit!.place;
      if (place.visits()?.length > 0) {
        this.markers.get(newPlaceId)?.setOffset([8, 0]);
      }
    }

    this.selectedOffsetPlaceId = newPlaceId;
    if (selectedVisit) this.interactionManager.handleMarkerUnhover();
  }

  private syncMarkers() {
    const map = this.map();
    const trip = this.tripService.trip();
    const places = trip?.placesArray() ?? [];
    this.markerElements();
    const isReady = this.layersReady();

    if (!map || !trip || !isReady) return;

    // Both signals above are intentionally read outside the deferred callback:
    // adding a place updates `placesArray`, and Angular then updates the
    // `viewChildren` query with its rendered marker component.
    setTimeout(() => {
      this.updateMarkers(places, this.markerElements());
    });
  }

  private syncRoutes() {
    const routesData = this.tripService.trip()?.routesGeoJson();
    const isReady = this.layersReady();
    if (isReady && routesData && this.layerManager) {
      console.log(routesData);
      this.layerManager.updateRouteData(routesData);
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  handleEsc(event: any) {
    if (this.uiService.drawingState().active) {
      this.interactionManager?.cancelDrawing();
    }
    if (this.uiService.isCustomSearchActive()) {
      this.uiService.toggleCustomSearchActive();
    }
  }

  private updateMarkers(places: Place[], components: readonly PlaceMarker[]) {
    const map = this.map();
    if (!map || !this.interactionManager) return;
    components.forEach((component) => {
      const el = (component as any).elementRef.nativeElement;
      const place = component.place();
      const placeId = place.id;
      const marker = this.markers.get(placeId);

      // Mapbox takes ownership of the component's host element. Angular can
      // replace that host during a re-render, so reattach only when needed.
      if (!marker || this.markerElementsById.get(placeId) !== el) {
        marker?.remove();
        const newMarker = new this.mapbox.Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(map);
        this.markers.set(placeId, newMarker);
        this.markerElementsById.set(placeId, el);
        component.setResources(this.interactionManager, newMarker);
      }
    });
    this.markers.forEach((marker, id) => {
      if (!places.find(p => p.id === id)) {
        marker.remove();
        console.log('deleting marker');
        this.markers.delete(id);
        this.markerElementsById.delete(id);
      }
    });
  }

  handleTypeSelection(type: RouteType) {
    this.interactionManager.handleTypeSelection(type);
  }

  handlePlaceSave(updatePlace: UpdatePlace) {
    console.log('place saved from its popup.', updatePlace);
    // this.tripService.savePlace(place);
    // Optionally close the popup after save
    this.uiService.clearSelection();
  }

  handleVisitDelete(visitId: string) {
    console.log('visit deleted from its popup.');
    if (confirm('Are you sure?')) {
      this.uiService.clearSelection();
      // this.tripService.deletePlace(place);
    }
  }

  handleRouteSave(updateRoute: any) {
    console.log('route saved from its popup.', updateRoute);
    // this.tripService.savePlace(place);
    // Optionally close the popup after save
    this.interactionManager.closeActiveRoutePopup();
  }

  handleRouteDelete(routeId: string) {
    console.log('route deleted from its popup.');
    if (confirm('Are you sure?')) {
      // this.tripService.deletePlace(place);
      this.interactionManager.closeActiveRoutePopup();
    }
  }

  getRouteIcon(type: string | undefined | null): string {
    if (!type) return 'milestone';
    return ROUTE_ICON_MAP[type.toLowerCase()] || 'milestone';
  }

  getRouteColor(type: string | undefined | null): string {
      if (!type) return ROUTE_COLORS.undefined;
      // @ts-ignore
      return ROUTE_COLORS[type.toLowerCase()] || ROUTE_COLORS.undefined;
    }

  ngOnDestroy() {
    this.interactionManager?.destroy();

    const map = this.map();
    if (map) map.remove();
    this.map.set(null);
  }

  private getInitialStyle() {
    const user = this.authService.user();
    const tripId = this.navigationService.tripId();

    const isAuthenticated = !!user;
    const hasSelectedTrip = !!tripId;

    if (hasSelectedTrip) return MAP_STYLES.ACTIVE_TRIP;
    if (isAuthenticated) return MAP_STYLES.LOGGED_IN;
    return MAP_STYLES.LOGGED_OUT;
  }
}
