import {Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, effect} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from '../../services/auth';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';
import { Place } from '../../models/place';

const INITIAL_CENTER: [number, number] = [-98.54818, 40.00811];
const INITIAL_ZOOM = 3.2;
const MAP_STYLES = {
  LOGGED_OUT: 'dark-v11',
  LOGGED_IN: 'light-v11',
  ACTIVE_TRIP: 'streets-v12'
};


@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.html',
  styleUrls: ['./map.css']
})
export class Map implements OnInit, OnDestroy {
  authService = inject(AuthService);
  tripService = inject(TripService);
  uiService = inject(UiService);
  private destroy$ = new Subject<void>();
  private currentStyle = '';
  isMapVisible = signal(false);

  constructor() {
    effect(() => {
      const user = this.authService.user();
      const plan = this.tripService.plan();
      this.updateStyle(user, plan);
    });

    effect(() => {
      const trip = this.tripService.trip();
      if (!!trip) {
        // this.renderAllTripPlaces(trip.places);
      } else {
        // this.clearPlaceMarkers();
      }
    });

    effect(() => {
      const plan = this.tripService.plan();
      this.applyPadding();
      if (plan) {
        // this.renderItinerary(plan.visits);
        // this.flyToSavedView(plan.lat, plan.lng, plan.zoom);
      } else {
        // this.clearItinerary();
      }
    });

    effect(() => {
      const isMobile = this.uiService.isMobile();
      const isSidebarOpen = this.uiService.isSidebarOpen();
      this.applyPadding();
    });
  }

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  private platformId = inject(PLATFORM_ID);

  center = signal<[number, number]>(INITIAL_CENTER);
  zoom = signal<number>(INITIAL_ZOOM);
  private currentMarkers: any[] = [];

  async ngOnInit() {
    this.initializeMap();
  }

  clearMap() {
    this.applyPadding();
    this.updateStyle();
  }

  async initializeMap() {
    if (isPlatformBrowser(this.platformId)) {
      const mapboxgl = (await import('mapbox-gl')).default;
      const user = this.authService.user();
      const plan = this.tripService.plan();
      this.map = new mapboxgl.Map({
        accessToken: 'pk.eyJ1IjoiZG9taW5pcXVlc29tbWVycyIsImEiOiJjbWNoeHNnZG4wMHk1MmtzOGtodnluZHJzIn0.j0bybMxwa2BK4UgPIhxpQw',
        container: this.mapContainer.nativeElement,
        center: this.center(),
        zoom: this.zoom(),
        style: `mapbox://styles/mapbox/${this.getStyle(user, plan)}?optimize=true`,
        logoPosition: 'bottom-right'
      });

      this.map.once('load', () => {
        this.isMapVisible.set(true);
      });

      this.map.on('load', () => {
        this.applyPadding();
      });
    }
  }

  // renderMarkers(places: Place[]) {
  //   // Logic to clear old markers and add new ones
  //   places.forEach(place => {
  //     const marker = L.marker([place.lat, place.lng]).addTo(this.map);
  //     marker.bindPopup(`
  //       <input id="edit-name-${place.id}" value="${place.name}" />
  //       <button onclick="window.updateName('${place.id}')">Save</button>
  //     `);
  //   });
  // }

  private applyPadding() {
    if (!this.map) return;
    const leftPadding = (this.uiService.isMobile() || !this.tripService.plan() || !this.uiService.isSidebarOpen()) ? 0 : 445
    this.map.easeTo({ padding: { left: leftPadding }, duration: 1000 })
  }

  private getStyle(user: any, plan: any) {
    return (!user) ? MAP_STYLES.LOGGED_OUT : (!plan ? MAP_STYLES.LOGGED_IN : MAP_STYLES.ACTIVE_TRIP);
  }

  private updateStyle(user?: any, plan?: any) {
    if (!this.map) return;
    const nextStyle = this.getStyle(user, plan);
    if (this.currentStyle !== nextStyle) {
      this.map.setStyle(`mapbox://styles/mapbox/${nextStyle}?optimize=true`);
      this.currentStyle = nextStyle;
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
