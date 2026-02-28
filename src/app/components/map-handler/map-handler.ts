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
  ChangeDetectorRef, ViewChildren, QueryList, computed, HostListener, untracked, viewChildren, viewChild, Injector
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
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

import {MAP_STYLES, INITIAL_CENTER, INITIAL_ZOOM, ROUTE_ICONS} from './config/map-styles.config';
import { MapSearch } from '../map-search/map-search';
import {RoutePopup} from '../route-popup/route-popup';


@Component({
  selector: 'app-map',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, PlaceMarker, VisitPopup, RoutePopup, PlaceTooltip, RouteTooltip, LucideAngularModule,
    MapSearch],
  templateUrl: './map-handler.html',
  styleUrls: ['./map-handler.css']
})
export class MapHandler implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  readonly tripService = inject(TripService);
  readonly uiService = inject(UiService);
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

  isMapVisible = signal(false);
  layersReady = signal(false);

  private markers: Map<string, Marker> = new Map();

  // TODO move to config.
  private readonly routeIconMap: Record<string, string> = {
    'flying': 'plane',
    'bus': 'bus',
    'train': 'train-front',
    'driving': 'car',
    'boat': 'ship',
  };
  readonly availableTypes: RouteType[] = ['flying', 'bus', 'train', 'driving', 'boat'];

  // hoveredPlace = signal<Place | null>(null);
  // hoveredRoute = signal<Route | null>(null);

  constructor() {
    effect(() => this.syncUI());
    effect(() => this.syncTheme());
    effect(() => this.syncMarkers());
    effect(() => this.syncRoutes());
    effect(() => this.syncSelectedVisit());
    effect(() => this.syncDrawer());
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.initializeMap();
    }
  }

  private async initializeMap() {
    console.log('Initialize map.')
    this.mapbox = (await import('mapbox-gl')).default;
    this.mapbox.accessToken = environment.mapboxToken;

    const map = new this.mapbox.Map({
      container: this.mapContainer().nativeElement,
      style: `mapbox://styles/mapbox/${MAP_STYLES.LOGGED_OUT}`,
      center: this.center(),
      zoom: this.zoom(),
      config: { basemap: { lightPreset: 'night' } },
      logoPosition: 'bottom-right',
      attributionControl: false
    });

    map.on('load', () => {
     this.interactionManager = new MapInteractionManager(
       map, this.mapbox, this.tripService, this.uiService, this.visitPopupEl, this.routePopupEl,
       this.placeTooltipEl, this.routeTooltipEl, this.selectorVisible, this.selectorPos, this.injector
     );
     this.interactionManager.attachGlobalListeners(this.center, this.zoom);
    });

    map.on('style.load', async () => {
      this.layersReady.set(false); // Reset while we rebuild
      if (!this.iconLoader) this.iconLoader = new IconLoader(map);
      if (!this.layerManager) this.layerManager = new MapLayerManager(map, this.authService);
      if (!this.interactionManager) this.interactionManager = new MapInteractionManager(
        map, this.mapbox, this.tripService, this.uiService, this.visitPopupEl, this.routePopupEl,
        this.placeTooltipEl, this.routeTooltipEl, this.selectorVisible, this.selectorPos, this.injector
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
    const padding = this.uiService.sidePanelWidth();
    const map = this.map();
    if (!map) return;
    map.easeTo({ padding: { left: padding }, duration: 500 });
  }

  private syncTheme() {
    const offline = this.authService.isOfflineMode();
    const user = this.authService.user();
    const plan = this.tripService.plan();
    const map = this.map();
    if (!map) return;
    this.layerManager?.updateStyle(user, plan);
  }

  private syncSelectedVisit() {
    const selectedPlace = this.uiService.selectedVisit();
    if (!selectedPlace) return;
    this.interactionManager.handleMarkerUnhover();
  }

  private syncMarkers() {
    const map = this.map();
    const trip = this.tripService.trip();
    console.log('syncMarkers!', trip?.placesArray().length);
    // TODO delete existing markers if no places.
    if (!map || !trip) return;
    // console.log('syncMarkers111!', trip?.placesArray().length);
    // TODO this should no need a timeout as this.markerElements is a signal, but without, it doesn't seem to work.
    setTimeout(() => {
      const components = this.markerElements();
      // console.log('syncMarkers222!', trip?.placesArray().length);
      if (!components || components.length === 0) return;
      // console.log('syncMarkers333!', trip?.placesArray().length);
      this.updateMarkers(trip.placesArray() ?? [], components);
    }, 500);
  }

  private syncRoutes() {
    const routesData = this.tripService.trip()?.routesGeoJson();
    const isReady = this.layersReady();
    // console.log('sync routes');
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
  }

  private updateMarkers(places: Place[], components: readonly PlaceMarker[]) {
    const map = this.map();
    // console.log('trying to update markers!!!', !map, !this.interactionManager)
    if (!map || !this.interactionManager) return;
    // console.log('updating markers!!!')
    components.forEach((component) => {
      const el = (component as any).elementRef.nativeElement;
      const place = component.place();
      const placeId = place.id;
      if (!this.markers.has(placeId) || true) { // TODO fix this.
        const marker = new this.mapbox.Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(map);
        this.markers.set(placeId, marker);
        component.setResources(this.interactionManager, marker);
      } else {
        console.log('skip marker');
      }
    });
    this.markers.forEach((marker, id) => {
      if (!places.find(p => p.id === id)) {
        marker.remove();
        console.log('deleting marker');
        this.markers.delete(id);
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
    return this.routeIconMap[type.toLowerCase()] || 'milestone';
  }

  ngOnDestroy() {
    this.interactionManager?.destroy();

    const map = this.map();
    if (map) map.remove();
    this.map.set(null);
  }

  private getInitialStyle() {
    const user = this.authService.user();
    const plan = this.tripService.plan();
    return (!user) ? MAP_STYLES.LOGGED_OUT : (!plan ? MAP_STYLES.LOGGED_IN : MAP_STYLES.ACTIVE_TRIP);
  }
}
