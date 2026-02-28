import {Injectable, inject, signal, WritableSignal, computed, effect, untracked} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {map, Subject} from 'rxjs';
import {TripService} from './trip';
import {Visit} from '../models/visit';
import {Place} from '../models/place';
import {Route} from '../models/route';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {LngLatLike} from 'mapbox-gl';

export interface FlyToRequest {
  center: [number, number];
  zoom?: number;
  pitch?: number;
}

export type DrawingState = {
  active: boolean;
  sourceVisit: Visit | null;
  targetVisit?: Visit | null;
  preselectedRoute?: Route;
};

@Injectable({ providedIn: 'root' })
export class UiService {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private breakpointObserver = inject(BreakpointObserver);
  private tripService = inject(TripService);

  // --- Layout State ---
  readonly isSidebarOpen: WritableSignal<boolean> = signal(true);
  readonly isLoading: WritableSignal<boolean> = signal(false);
  readonly isSearchExpanded: WritableSignal<boolean> = signal(false);

  // --- Interaction State (Moved from TripService) ---
  selectedVisitId = signal<string | null>(null);
  selectedRouteId = signal<string | null>(null);
  selectedVisit = computed(() => {
    const id = this.selectedVisitId();
    if (!id) return null;
    return this.tripService.plan()?.visits().get(id) ?? null;
  });
  selectedRoute = computed(() => {
    const id = this.selectedRouteId();
    if (!id) return null;
    return this.tripService.trip()?.routes().get(id) ?? null;
  });

  activeTab = signal<string>('itinerary');

  readonly hoveredPlace = signal<Place | null>(null);
  readonly hoveredVisit = signal<Visit | null>(null)
  readonly hoveredRoute = signal<Route | null>(null);
  readonly drawingState = signal<DrawingState>({ active: false, sourceVisit: null });

  readonly isMobile = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );
  readonly sidePanelWidth = computed(() => (this.isMobile() || !this.tripService.plan() || !this.isSidebarOpen()) ? 0 : 445);

  private flyToSubject = new Subject<FlyToRequest>();
  flyToRequested$ = this.flyToSubject.asObservable();

  constructor() {
    this.tripService.resetInteraction$
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.resetInteractionState();
      });

    this.route.queryParams.subscribe(params => {
      const vId = params['visitId'] ?? null;
      const rId = params['routeId'] ?? null;
      const tab = params['tab'] || 'itinerary';
      if (this.selectedVisitId() !== vId) this.selectedVisitId.set(vId);
      if (this.selectedRouteId() !== rId) this.selectedRouteId.set(rId);
      if (this.activeTab() !== tab) this.activeTab.set(tab);
    });

    const route = inject(ActivatedRoute);
    const router = inject(Router);

    const params = route.snapshot.queryParamMap;
    const tab = params.get('tab');
    if (tab) this.activeTab.set(tab);

    effect(() => {
      const queryParams: any = { tab: this.activeTab() };
      if (this.selectedVisitId()) queryParams.visitId = this.selectedVisitId();
      if (this.selectedRouteId()) queryParams.routeId = this.selectedRouteId();
      console.log('navigate to', queryParams)

      // untracked(() => {
      //   this.router.navigate([], {
      //     relativeTo: this.route,
      //     queryParams,
      //     queryParamsHandling: 'merge',
      //     replaceUrl: true
      //   });
      // });
    });
  }

  selectVisit(id: string | null) {
    if (!id) return this.clearSelection();
    this.selectedRouteId.set(null);
    this.selectedVisitId.set(id);
    this.activeTab.set('bookings');
  }

  selectRoute(id: string | null, coords?: LngLatLike) {
    console.log('select route', id)
    if (!id) return this.clearSelection();
    this.selectedVisitId.set(null);
    this.selectedRouteId.set(id);
    const selectedRoute = this.selectedRoute();
    if (selectedRoute) {
      console.log('fast enoguh')
      selectedRoute.popupCoords = coords ?? selectedRoute.middlePoint();
    } else {
      console.log('not fast enoguh')
    }
    this.activeTab.set('bookings');
  }

  clearSelection() {
    console.log('clear selection');
    this.selectedVisitId.set(null);
    this.selectedRouteId.set(null);
    this.activeTab.set('itinerary');
    console.log(this.selectedVisitId());
  }

  triggerFlyTo(data: FlyToRequest) {
    this.flyToSubject.next(data);
  }

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  toggleSearch() {
    this.isSearchExpanded.update(v => !v);
  }

  closeSearch() {
    this.isSearchExpanded.set(false);
  }

  setLoading(state: boolean) {
    this.isLoading.set(state);
  }

  resetInteractionState() {
    this.selectedVisitId.set(null);
    this.hoveredPlace.set(null);
    this.selectedRouteId.set(null);
    this.hoveredRoute.set(null);
    this.drawingState.set({ active: false, sourceVisit: null });
  }
}
