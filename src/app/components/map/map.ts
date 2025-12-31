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
  ChangeDetectorRef, ViewChildren, QueryList, computed, HostListener
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { LucideAngularModule, Search } from 'lucide-angular';
import { AuthService } from '../../services/auth';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';
import { Place } from '../../models/place';
import { PlacePopup } from '../place-popup/place-popup';
import { PlaceMarker } from '../place-marker/place-marker';
import { PlaceTooltip } from '../place-tooltip/place-tooltip';
// import { MapboxSearchBox } from '@mapbox/search-js-web';


const INITIAL_CENTER: [number, number] = [2.35, 48.85];
const INITIAL_ZOOM = 3.2;
const MAP_STYLES = {
  LOGGED_OUT: 'dark-v11',
  LOGGED_IN: 'light-v11',
  ACTIVE_TRIP: 'streets-v12'
};


@Component({
  selector: 'app-map',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [CommonModule, PlaceMarker, PlacePopup, PlaceTooltip, LucideAngularModule],
  templateUrl: './map.html',
  styleUrls: ['./map.css']
})
export class Map implements OnInit, OnDestroy {
  readonly fallbackSignal = signal('');
  accessToken: string = 'pk.eyJ1IjoiZG9taW5pcXVlc29tbWVycyIsImEiOiJjbWNoeHNnZG4wMHk1MmtzOGtodnluZHJzIn0.j0bybMxwa2BK4UgPIhxpQw';
  authService = inject(AuthService);
  tripService = inject(TripService);
  uiService = inject(UiService);
  readonly SearchIcon = Search;
  private cdr = inject(ChangeDetectorRef);
  private map: any;
  private mapbox: any;
  private searchBoxElement: any;
  // private topSuggestion: any = null;
  private currentStyle = '';
  isMapVisible = signal(false);
  selectedPlace = signal<Place | null>(null);
  hoveredPlace = signal<Place | null>(null);
  isSearchExpanded = signal(false);
  sidePanelWidth = computed(() => (this.uiService.isMobile() || !this.tripService.plan() || !this.uiService.isSidebarOpen()) ? 0 : 445);
  private currentPopup: any;
  private hoverPopup: any;
  private hoverTimer?: any;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  @ViewChild('searchWrapper', { static: true }) searchWrapper!: ElementRef<HTMLDivElement>;
  // @ViewChild('searchBox') searchBox!: ElementRef;
  @ViewChild('popupContainer', { static: true }) popupEl!: ElementRef;
  @ViewChild('tooltipContainer', { static: true }) tooltipEl!: ElementRef;
  @ViewChildren('markerElement') markerElements!: QueryList<ElementRef>;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    effect(() => {
      const user = this.authService.user();
      const plan = this.tripService.plan();
      this.updateStyle(user, plan);
    });

    effect(() => {
      const trip = this.tripService.trip();
      if (!!trip) {
        setTimeout(() => this.renderAllTripPlaces(trip.placesArray()), 0);
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

  center = signal<[number, number]>(INITIAL_CENTER);
  zoom = signal<number>(INITIAL_ZOOM);
  private currentMarkers: any[] = [];

  async ngOnInit() {
    this.initializeMap();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const container = this.searchWrapper?.nativeElement;
    const clickedInside = container?.contains(event.target as Node);
    if (this.isSearchExpanded() && !clickedInside) {
      this.toggleSearch();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    const container = this.searchWrapper?.nativeElement;
    if (this.isSearchExpanded()) {
      this.toggleSearch();
    }
  }

  clearMap() {
    this.applyPadding();
    this.updateStyle();
  }

  async initializeMap() {
    if (isPlatformBrowser(this.platformId)) {
      this.mapbox = (await import('mapbox-gl')).default;
      this.mapbox.accessToken = this.accessToken;
      const user = this.authService.user();
      const plan = this.tripService.plan();
      this.map = new this.mapbox.Map({
        // accessToken: accessToken,
        container: this.mapContainer.nativeElement,
        center: this.center(),
        zoom: this.zoom(),
        style: `mapbox://styles/mapbox/${this.getStyle(user, plan)}?optimize=true`,
        logoPosition: 'bottom-right'
      });

      this.map.once('load', async () => {
        this.isMapVisible.set(true);
        this.addControls();
        this.addSearchBox();
      });

      this.map.on('load', () => {
        this.applyPadding();
      });

      this.map.on('click', (e: any) => {
        this.selectedPlace.set(null);
        this.cdr.detectChanges();
        if (this.isSearchExpanded()) {
          this.isSearchExpanded.set(false);
        }
      });

      this.map.on('move', () => {
        const newCenter = this.map.getCenter();
        this.center.set([newCenter.lng, newCenter.lat]);
        this.zoom.set(this.map.getZoom());
      });
    }
  }

  addControls() {
    const nav = new this.mapbox.NavigationControl();
    this.map.addControl(nav, 'bottom-right');
  }

  async addSearchBox() {
    const { MapboxSearchBox } = await import('@mapbox/search-js-web');
    this.searchBoxElement = new MapboxSearchBox();
    this.searchBoxElement.accessToken = this.accessToken!;
    this.searchBoxElement.placeholder = 'Where to?'
    this.searchBoxElement.marker = true;
    this.searchBoxElement.bindMap(this.map);
    this.searchWrapper.nativeElement.appendChild(this.searchBoxElement as unknown as HTMLElement);
    this.searchWrapper.nativeElement.style.width = '100%';      // container full width
    this.searchWrapper.nativeElement.style.display = 'block';
    this.searchBoxElement.addEventListener('retrieve', (e: any) => {
      this.handleSearchResult(e);
    });
    this.searchBoxElement.theme = {
      variables: {
        colorBackground: 'rgba(30, 30, 35, 0.7)',
        backdropFilter: 'blur(30px) saturate(180%)',
        colorText: '#fff',
        borderRadius: '20px',
        width: '100%',
        boxShadow: 'none'
      },
      cssText: `
        .SearchIcon {
          display: none !important;
        }
        .Input {
          width: 100% !important;
          padding-left: 12px !important;
          color: #fff !important;
        }
        ::placeholder {
          color: #fff !important;
        }
        .Results {
          bottom: 53px !important;
          top: auto !important;
          margin-bottom: 6px !important;
          margin-top: 0 !important;
          transform: translateX(-37px) !important;
        }
        .Suggestion {
          color: #fff !important;          /* suggestion text white */
          background-color: rgba(0, 0, 0, 0.25) !important; /* hover background */
        }
        .Suggestion:hover,
        .Suggestion[aria-selected="true"] {
          background-color: rgba(0, 0, 0, 0.5) !important; /* selected item */
        }
      `
    };
  }

  toggleSearch() {
    this.isSearchExpanded.update(v => !v);
    if (this.isSearchExpanded()) {
      setTimeout(() => {
        this.searchBoxElement.focus();
      }, 100);
    }
  }

  handleSearchResult(event: any) {
    console.log(event);
    const feature = event.detail.features[0];
    this.isSearchExpanded.set(false);
    // this.searchBoxElement.clear();
    this.searchBoxElement.blur();
    // this.topSuggestion = null;
    console.log('searched for', feature);
    // ... map.flyTo logic
  }

  renderAllTripPlaces(places: Place[]) {
    if (!this.map || !this.mapbox) return;
    this.cdr.detectChanges();
    const markerElements = this.markerElements.toArray();

    places.forEach((place, index) => {
      console.log(place.toJSON());
      if (markerElements.length <= index) return;
      const markerElement = markerElements[index].nativeElement;
      const marker = new this.mapbox.Marker({ element: markerElement, anchor: 'center' })
        .setLngLat([place.lng, place.lat])
        .addTo(this.map);

      markerElement.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        if (this.hoverPopup) this.hoverPopup.remove();
        this.openPopup(place, marker);
      });
    });
  }

  openPopup(place: Place, marker: any) {
    this.selectedPlace.set(place);
    this.cdr.detectChanges();

    setTimeout(() => {
      if (this.currentPopup) this.currentPopup.remove();

      this.currentPopup = new this.mapbox.Popup({
        offset: 25,
        closeButton: false,
        className: 'apple-glass-popup'
      })
      .setDOMContent(this.popupEl.nativeElement)
      .setLngLat(marker.getLngLat())
      .addTo(this.map);
    }, 0);
  }

  onMouseEnter(place: Place) {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      this.hoveredPlace.set(place);
      if (!this.hoverPopup) {
        this.hoverPopup = new this.mapbox.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 15,
          className: 'hover-tooltip'
        });
      }
      this.hoverPopup
        .setLngLat([place.lng, place.lat])
        .setDOMContent(this.tooltipEl.nativeElement)
        .addTo(this.map);
    }, 120);
  }

  onMouseLeave() {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    this.hoveredPlace.set(null);
    this.hoverPopup?.remove();
  }

  handleSave(event: any) {

  }

  handleDelete(event: any) {

  }

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
    if (this.currentPopup) {
      this.currentPopup.remove();
    }
    if (this.map) {
      this.map.remove();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  protected readonly Array = Array;
}
