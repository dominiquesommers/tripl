import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, filter, take } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map, shareReplay } from 'rxjs/operators';
import { AuthService } from './auth';
import { ApiService } from './api';
import { ActivatedRoute } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class TripService {
  private userTripsSubject = new BehaviorSubject<any>(null);
  userTrips$ = this.userTripsSubject.asObservable();
  private activeTripSubject = new BehaviorSubject<any>(null);
  activeTrip$ = this.activeTripSubject.asObservable();
  private activePlanSubject = new BehaviorSubject<any>(null);
  activePlan$ = this.activePlanSubject.asObservable();
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  private breakpointObserver = inject(BreakpointObserver);
  isMobile$ = this.breakpointObserver
    .observe([Breakpoints.Handset])
    .pipe(map(result => result.matches), shareReplay(1));
  private sidebarOpenSubject = new BehaviorSubject<boolean>(true);
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {
    combineLatest({
      user: this.authService.user$,
      nav: this.router.events.pipe(filter(e => e instanceof NavigationEnd))
    }).subscribe(({ user }) => {
      const params = this.getParams(this.route.root);
      const tripId = params['tripId'];
      const planId = params['planId'];
      if (user) {
        if (tripId) {
          // User is logged in AND looking at a specific trip
          this.fetchUserDataAndContext(user.uid, tripId, planId);
        } else {
          // User is logged in BUT at /select or /
          // We still need to call the backend to get the list of "userTrips"
          this.fetchUserDataAndContext(user.uid);
        }
      } else {
        this.clearActiveTrip();
      }
    });
  }

  private async fetchUserDataAndContext(userId: string, tripId?: string, planId?: string) {
    console.log(`Fetching data for User: ${userId}. Requested Trip: ${tripId}`);
    this.loadingSubject.next(true);

    this.apiService.getSyncData(userId, tripId, planId).subscribe({
      next: (response: any) => {
        // Always update the list of trips for the menu
        this.userTripsSubject.next(response.userTrips || []);

        console.log('response', response);
        if (response.activeTrip) {
          this.activeTripSubject.next(response.activeTrip);
          if (response.activePlan) {
            this.activePlanSubject.next(response.activePlan);
          }

          // this.pinsSubject.next(response.activeTrip.pins || []);
          // ... plan logic ...
        } else {
          this.activeTripSubject.next(null);
          // this.pinsSubject.next([]);
        }
        this.loadingSubject.next(false);
      },
      error: (err) => {
        console.error("Sync failed", err);
        this.clearActiveTrip();
        this.loadingSubject.next(false);
      }
    });
  }

  clearActiveTrip() {
    this.activeTripSubject.next(null);
    this.activePlanSubject.next(null);
    // this.pinsSubject.next([]);
    console.log("TripService: State cleared (User logged out or returned to home)");
  }

  toggleSidebar() {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  isSidebarOpen(): boolean {
    return this.sidebarOpenSubject.value && this.getCurrentTripValue() && this.getCurrentPlanValue();
  }

  get isMobile(): boolean {
    return this.breakpointObserver.isMatched(Breakpoints.Handset);
  }

  getCurrentTripValue() {
    return this.activeTripSubject.value;
  }

  getCurrentPlanValue() {
    return this.activePlanSubject.value;
  }

  // Method to handle manual plan selection from the bubble
  setActivePlan(plan: any) {
    this.activePlanSubject.next(plan);
  }

  updatePlanPriorities(plans: any[]) {
    // Update the 'priority' property based on the new array index
    const updatedPlans = plans.map((plan, index) => ({
      ...plan,
      priority: index + 1
    }));

    // Update the active trip with the new plan order
    const currentTrip = this.activeTripSubject.value;
    if (currentTrip) {
      this.activeTripSubject.next({ ...currentTrip, plans: updatedPlans });
    }

    // In the future, you'd send 'updatedPlans' to your Google Function here:
    // this.http.post('api/update-priorities', { plans: updatedPlans }).subscribe();
    console.log('Priorities updated in Service:', updatedPlans);
  }

  private getParams(route: ActivatedRoute): any {
    let params = { ...route.snapshot.params };
    if (route.firstChild) {
      params = { ...params, ...this.getParams(route.firstChild) };
    }
    return params;
  }
}
