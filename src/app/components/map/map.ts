
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

const INITIAL_CENTER: [number, number] = [-98.54818, 40.00811];
const INITIAL_ZOOM = 3.2;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.html',
  styleUrls: ['./map.css']
})
export class Map implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  private platformId = inject(PLATFORM_ID);

  // Signals to track center and zoom
  center = signal<[number, number]>(INITIAL_CENTER);
  zoom = signal<number>(INITIAL_ZOOM);

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) { // SSR check to ensure this runs in the browser as GL JS requires a browser environment
      const mapboxgl = (await import('mapbox-gl')).default // dynamically import mapbox-gl as the default export

      // Create a new map instance
      this.map = new mapboxgl.Map({
        accessToken: 'pk.eyJ1IjoiZG9taW5pcXVlc29tbWVycyIsImEiOiJjbWNoeHNnZG4wMHk1MmtzOGtodnluZHJzIn0.j0bybMxwa2BK4UgPIhxpQw',
        container: this.mapContainer.nativeElement, // Reference to the map container element
        center: this.center(),
        zoom: this.zoom()
      });

      this.map.on('move', () => {
        const newCenter = this.map.getCenter();
        this.center.set([newCenter.lng, newCenter.lat]);
        this.zoom.set(this.map.getZoom());
      });
    }
  }

  resetView() {
    this.map.flyTo({
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      essential: true
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }
}
