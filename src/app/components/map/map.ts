import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from '../../services/auth';
import { TripService } from '../../services/trip';

const INITIAL_CENTER: [number, number] = [-98.54818, 40.00811];
const INITIAL_ZOOM = 3.2;
const MAP_STYLES = {
  LOGGED_OUT: 'dark-v11',
  LOGGED_IN: 'light-v11',
  ACTIVE_TRIP: 'standard'
};


@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.html',
  styleUrls: ['./map.css']
})
export class Map implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private currentStyle = '';
  isMapVisible = false;

  constructor(
    private authService: AuthService,
    private tripService: TripService
  ) {}

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  private platformId = inject(PLATFORM_ID);

  center = signal<[number, number]>(INITIAL_CENTER);
  zoom = signal<number>(INITIAL_ZOOM);
  private currentMarkers: any[] = [];

  async ngOnInit() {
    this.initializeMap();

    combineLatest({
      user: this.authService.user$,
      trip: this.tripService.activeTrip$,
      plan: this.tripService.activePlan$
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe(({ user, trip, plan }) => {
      this.updateMapStyle(user, trip, plan);
    });

    this.tripService.isMobile$
    .pipe(takeUntil(this.destroy$))
    .subscribe(isMobile => {
      this.applyPadding();
    });

    this.tripService.sidebarOpen$.pipe(takeUntil(this.destroy$))
      .subscribe(sidebarOpen => {
        this.applyPadding();
      });

    // TODO add pin listener logic here!
    // this.tripService.pins$.pipe(takeUntil(this.destroy$)).subscribe(pins => {
    //   if (pins && pins.length > 0) {
    //     // If the map is currently busy changing styles, wait for it
    //     if (!this.map.isStyleLoaded()) {
    //       this.map.once('style.load', () => this.renderMarkers(pins));
    //     } else {
    //       this.renderMarkers(pins);
    //     }
    //   } else {
    //     this.clearMarkers();
    //   }
    // });
  }

  async initializeMap() {
    if (isPlatformBrowser(this.platformId)) {
      const mapboxgl = (await import('mapbox-gl')).default;
      const user = this.authService.getCurrentUserValue();
      const trip = this.tripService.getCurrentTripValue();
      const plan = this.tripService.getCurrentPlanValue();
      this.map = new mapboxgl.Map({
        accessToken: 'pk.eyJ1IjoiZG9taW5pcXVlc29tbWVycyIsImEiOiJjbWNoeHNnZG4wMHk1MmtzOGtodnluZHJzIn0.j0bybMxwa2BK4UgPIhxpQw',
        container: this.mapContainer.nativeElement,
        center: this.center(),
        zoom: this.zoom(),
        style: `mapbox://styles/mapbox/${this.getStyle(user, trip, plan)}?optimize=true`,
        logoPosition: 'bottom-right'
      });

      this.map.once('load', () => {
        this.isMapVisible = true;
      });

      this.map.on('load', () => {
        this.applyPadding();
        // 2. Tune into the pins radio station here
        // this.tripService.pins$.subscribe(pins => {
        //   // We still check pins.length, but we also ensure this.map exists
        //   if (pins && this.map) {
        //     this.updateMapMarkers(pins);
        //   }
        // });
      });

      this.map.on('move', () => {
        const newCenter = this.map.getCenter();
        this.center.set([newCenter.lng, newCenter.lat]);
        this.zoom.set(this.map.getZoom());
      });
    }
  }

  private applyPadding() {
    if (!this.map) return;
    console.log('apply padding', this.tripService.isSidebarOpen())
    this.map.easeTo({ padding: { left: (this.tripService.isMobile || !this.tripService.isSidebarOpen()) ? 0 : 300 }, duration: 1000 })
  }

  private getStyle(user: any, trip: any, plan: any) {
    return (!user) ? MAP_STYLES.LOGGED_OUT : (!(trip && plan) ? MAP_STYLES.LOGGED_IN : MAP_STYLES.ACTIVE_TRIP);
  }

  private updateMapStyle(user: any, trip: any, plan: any) {
    if (!this.map) return;
    const nextStyle = this.getStyle(user, trip, plan);
    if (this.currentStyle !== nextStyle) {
      this.map.setStyle(`mapbox://styles/mapbox/${nextStyle}?optimize=true`);
      this.currentStyle = nextStyle;
    }
  }

  resetView() {
    this.map.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      essential: true
    });
  }

  // updateMapMarkers(pins: Pin[]) {
  //   // 1. Remove existing markers from the map
  //   this.currentMarkers.forEach(marker => marker.remove());
  //   this.currentMarkers = [];
  //
  //   // 2. Add new markers
  //   pins.forEach(pin => {
  //     const marker = new mapboxgl.Marker()
  //       .setLngLat(pin.getLngLat()) // Using your Smart Model helper!
  //       .setPopup(new mapboxgl.Popup().setHTML(`<h3>${pin.title}</h3>`))
  //       .addTo(this.map);
  //
  //     this.currentMarkers.push(marker);
  //   });
  // }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }
}
