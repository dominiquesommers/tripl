import {Injectable, inject, signal, WritableSignal, effect, computed} from '@angular/core';
import { Observable, tap, forkJoin, switchMap} from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api';
import { IUserTrip } from '../models/user';
import { Trip } from '../models/trip';
import { Plan } from '../models/plan';
import { Country } from '../models/country';
import { Season } from '../models/season';
import { Place } from '../models/place';
import { Visit } from '../models/visit';
import { AuthService } from './auth';

@Injectable({ providedIn: 'root' })
export class TripService {
  apiService = inject(ApiService);
  authService = inject(AuthService);

  readonly trips: WritableSignal<IUserTrip[] | null> = signal(null);
  readonly trip: WritableSignal<Trip | null> = signal(null);
  readonly plan: WritableSignal<Plan | null> = signal(null);

  plans = computed(() => {
    const plans = this.trips()?.find(trip => trip.id === this.trip()?.id)?.plans;
    return plans ?? [];
  })

  constructor() {
    effect(() => {
      const userId = this.authService.user()?.uid;
      this.clearTrips();
      if (userId) {
        this.loadTrips();
      }
    });
  }

  clearTrips() {
    this.trips.set(null);
    this.clearTrip();
  }

  clearTrip() {
    this.trip.set(null);
    this.clearPlan();
  }

  clearPlan() {
    this.plan.set(null);
  }

  loadTrips() {
    this.apiService.getUserTrips().pipe(
      map(rawTrips => rawTrips.map(trip => this.createUserTrip(trip)))
    ).subscribe(userTrips => {
      this.trips.set(userTrips);
    });
  }

  private createUserTrip(raw: any): IUserTrip {
    return {
      id: raw.id,
      name: raw.name,
      plans: (raw.plans || [])
        .map((p: any) => ({ id: p.id, name: p.name, priority: p.priority }))
        .sort((a: any, b: any) => a.priority - b.priority)
    };
  }

  loadTrip(tripId: string): Observable<Trip> {
    this.clearTrip();
    return forkJoin({
      t: this.apiService.getTrip(tripId),
      p: this.apiService.getPlaces(tripId),
      c: this.apiService.getCountries(),
      s: this.apiService.getSeasons()
    }).pipe(
      map(data => {
        const countries = data.c.map(x => new Country(x));
        const seasons = data.s.map(x => new Season(x));
        const places = data.p.map(rawPlace => {
          const p = new Place(rawPlace, this);
          p.country = countries.find(c => c.id === p.country_id);
          p.season = seasons.find(s => s.id === p.season_id);
          return p;
        });
        return new Trip(data.t, places);
      }),
      tap(trip => this.trip.set(trip))
    );
  }

  loadPlan(planId: string) {
    this.clearPlan();
    this.apiService.getPlan(planId).pipe(
      switchMap(rawPlan => {
        return this.apiService.getVisits(planId).pipe(
          map(rawVisits => {
            const currentPlaces = this.trip()?.places() || [];
            const visits = rawVisits.map(v => {
              const visit = new Visit(v);
              visit.place = currentPlaces.find(p => p.id === visit.place_id);
              return visit;
            });
            return new Plan(rawPlan, visits);
          })
        );
      })
    ).subscribe(plan => this.plan.set(plan));
  }
}










  // private async fetchUserDataAndContext(userId: string, tripId?: string, planId?: string) {
  //   console.log(`Fetching data for User: ${userId}. Requested Trip: ${tripId} and Plan: ${planId}`);
  //   this._loading.next(true);
  //
  //   this.api.getSyncData(userId, tripId, planId).subscribe({
  //     next: (response: any) => {
  //       // Always update the list of trips for the menu
  //       this._userTrips.next(response.userTrips || []);
  //
  //       console.log('response', response);
  //       if (response.activeTrip) {
  //         this._activeTrip.next(response.activeTrip);
  //         if (response.activePlan) {
  //           this._activePlan.next(response.activePlan);
  //         }
  //       } else {
  //         this._activeTrip.next(null);
  //       }
  //       this._loading.next(false);
  //     },
  //     error: (err) => {
  //       console.error("Sync failed", err);
  //       this.clearActiveTrip();
  //       this._loading.next(false);
  //     }
  //   });
  // }

  // clearActiveTrip() {
  //   this._activeTrip.next(null);
  //   this._activePlan.next(null);
  //   console.log("TripService: State cleared (User logged out or returned to home)");
  // }

  // toggleSidebar() {
  //   this._isSidebarOpen.next(!this._isSidebarOpen.value);
  // }

  // get isSidebarOpen() {
  //   return this._isSidebarOpen.value;
  // }

  // get isMobile(): boolean {
  //   return this.breakpointObserver.isMatched(Breakpoints.Handset);
  // }

  // getActiveTrip() {
  //   return this._activeTrip.value;
  // }
  //
  // getCurrentPlanValue() {
  //   return this._activePlan.value;
  // }
  //
  // setActivePlan(plan: any) {
  //   this._activePlan.next(plan);
  // }

  // updatePlanPriorities(plans: any[]) {
  //   // Update the 'priority' property based on the new array index
  //   const updatedPlans = plans.map((plan, index) => ({
  //     ...plan,
  //     priority: index + 1
  //   }));
  //
  //   // Update the active trip with the new plan order
  //   const currentTrip = this._activeTrip.value;
  //   if (currentTrip) {
  //     this._activeTrip.next({ ...currentTrip, plans: updatedPlans });
  //   }
  //
  //   // In the future, you'd send 'updatedPlans' to your Google Function here:
  //   // this.http.post('api/update-priorities', { plans: updatedPlans }).subscribe();
  //   console.log('Priorities updated in Service:', updatedPlans);
  // }

// }
