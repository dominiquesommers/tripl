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
  ChangeDetectorRef, ViewChildren, QueryList, computed, HostListener, untracked
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { LucideAngularModule, Search } from 'lucide-angular';
import { AuthService } from '../../services/auth';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';
import {Place, UpdatePlace} from '../../models/place';
import { PlacePopup } from '../place-popup/place-popup';
import { PlaceMarker } from '../place-marker/place-marker';
import { PlaceTooltip } from '../place-tooltip/place-tooltip';
import { RouteTooltip } from '../route-tooltip/route-tooltip';
import type { Map as MapboxMap, GeoJSONSource, Marker, Popup } from 'mapbox-gl';
import {Route} from '../../models/route';
import { environment } from '../../../environments/environment';
import {MapLayerManager} from './utils/layer-factory';
import {IconLoader} from './utils/icon-loader';
import {MapInteractionManager} from './utils/interaction-handler';

import { MAP_STYLES, INITIAL_CENTER, INITIAL_ZOOM } from './config/map-styles.config';
import { MapSearch } from '../map-search/map-search';


@Component({
  selector: 'app-map',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, PlaceMarker, PlacePopup, PlaceTooltip, RouteTooltip, LucideAngularModule, MapSearch],
  templateUrl: './map-handler.html',
  styleUrls: ['./map-handler.css']
})
export class MapHandler implements OnInit, OnDestroy {
  // 1. Injected Services
  private authService = inject(AuthService);
  readonly tripService = inject(TripService);
  private uiService = inject(UiService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);

  // 2. Map Elements (The "Hands")
  private mapbox: any;
  map = signal<MapboxMap | null>(null);
  center = signal<[number, number]>(INITIAL_CENTER);
  zoom = signal<number>(INITIAL_ZOOM);
  private layerManager!: MapLayerManager;
  interactionManager!: MapInteractionManager
  private iconLoader!: IconLoader;

  // 3. Local UI State (Keep only what's needed for the template)
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @ViewChildren('markerElement') markerElements!: QueryList<ElementRef>;
  @ViewChild('popupContainer') popupEl!: ElementRef;
  @ViewChild('placeTooltipContainer', { static: true }) placeTooltipEl!: ElementRef;
  @ViewChild('routeTooltipContainer', { static: true }) routeTooltipEl!: ElementRef;

  isMapVisible = signal(false);
  layersReady = signal(false);

  private markers: Map<string, Marker> = new Map();
  private placePopup: any;

  hoveredPlace = signal<Place | null>(null);
  hoveredRoute = signal<Route | null>(null);

  constructor() {
    effect(() => this.syncUI());
    effect(() => this.syncTheme());
    effect(() => this.syncMarkers());
    effect(() => this.syncRoutes());
    effect(() => this.syncSelectedPlace());
  }

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.initializeMap();
    }
  }

  private async initializeMap() {
    this.mapbox = (await import('mapbox-gl')).default;
    this.mapbox.accessToken = environment.mapboxToken;

    const map = new this.mapbox.Map({
      container: this.mapContainer.nativeElement,
      style: `mapbox://styles/mapbox/${MAP_STYLES.LOGGED_OUT}`,
      center: this.center(),
      zoom: this.zoom()
    });

    map.on('load', () => {
     this.interactionManager = new MapInteractionManager(
       map, this.mapbox, this.tripService, this.uiService, this.popupEl.nativeElement, this.placeTooltipEl.nativeElement,
       this.routeTooltipEl.nativeElement, this.hoveredPlace, this.hoveredRoute
     );
     this.interactionManager.attachGlobalListeners(this.center, this.zoom);
    });

    map.on('style.load', async () => {
      this.layersReady.set(false); // Reset while we rebuild
      if (!this.iconLoader) this.iconLoader = new IconLoader(map);
      if (!this.layerManager) this.layerManager = new MapLayerManager(map);
      if (!this.interactionManager) this.interactionManager = new MapInteractionManager(
        map, this.mapbox, this.tripService, this.uiService, this.popupEl.nativeElement, this.placeTooltipEl.nativeElement,
        this.routeTooltipEl.nativeElement, this.hoveredPlace, this.hoveredRoute
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

  private syncUI() {
    const padding = this.uiService.sidePanelWidth();
    const map = this.map();
    if (!map) return;
    map.easeTo({ padding: { left: padding }, duration: 500 });
  }

  private syncTheme() {
    const user = this.authService.user();
    const plan = this.tripService.plan();
    const map = this.map();
    if (!map) return;
    this.layerManager?.updateStyle(user, plan);
  }

  private syncSelectedPlace() {
    const selectedPlace = this.tripService.selectedPlace();
    if (!selectedPlace) return;
    this.interactionManager.handleMarkerUnhover();
  }


  private syncMarkers() {
    const places = this.tripService.trip()?.placesArray() ?? [];
    const map = this.map();
    console.log('updateMarkers?', map);
    if (!map) return;
    console.log('nr of places', places.length);
    setTimeout(() => {
      const elements = this.markerElements;
      console.log('markerElement length:', elements.length);
      if (elements.length > 0) this.updateMarkers(places, elements);
    }, 10);
  }

  private syncRoutes() {
    const routesData = this.tripService.trip()?.routesGeoJson();
    const isReady = this.layersReady();
    if (isReady && routesData && this.layerManager) {
      this.layerManager.updateRouteData(routesData);
    }
  }

  private updateMarkers(places: Place[], elements: QueryList<ElementRef>) {
    const map = this.map();
    if (!map || !this.interactionManager) {
      return;
    }

    elements.forEach((ref) => {
      const el = ref.nativeElement;
      const placeId = el.getAttribute('data-id');
      const place = places.find(p => p.id === placeId);
      if (place && !this.markers.has(placeId)) {
        const marker = new this.mapbox.Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(map);
        this.markers.set(placeId, marker);
        this.interactionManager.wireMarker(place, marker, el);
      }
    });
    this.markers.forEach((marker, id) => {
      if (!places.find(p => p.id === id)) {
        marker.remove();
        this.markers.delete(id);
      }
    });
  }

  handleSave(updatePlace: UpdatePlace) {
    console.log('place saved from its popup.', updatePlace);
    // this.tripService.savePlace(place);
    // Optionally close the popup after save
    this.interactionManager.closeActivePopup();
  }

  handleDelete(placeId: string) {
    console.log('place deleted from its popup.');
    if (confirm('Are you sure?')) {
      // this.tripService.deletePlace(place);
      this.interactionManager.closeActivePopup();
    }
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
