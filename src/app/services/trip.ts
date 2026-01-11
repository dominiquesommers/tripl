import {Injectable, inject, signal, WritableSignal, effect, computed} from '@angular/core';
import {Observable, tap, forkJoin, switchMap, catchError, throwError, finalize, EMPTY} from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api';
import { IUserTrip } from '../models/user';
import { Trip } from '../models/trip';
import { Plan } from '../models/plan';
import { Country } from '../models/country';
import { Season } from '../models/season';
import {Place, NewPlace, UpdatePlace, IPlace, IPlaceWithCountry} from '../models/place';
import { NewVisit, Visit } from '../models/visit';
import { AuthService } from './auth';
import {Traverse} from '../models/traverse';
import {Route, RouteType} from '../models/route';
import {ROUTE_ICONS} from '../components/map-handler/config/map-styles.config';

export type DrawingState = {
  active: boolean;
  sourceVisit: Visit | null;
  targetVisit?: Visit | null;
  preselectedRoute?: Route;
};

@Injectable({ providedIn: 'root' })
export class TripService {
  apiService = inject(ApiService);
  authService = inject(AuthService);

  readonly trips: WritableSignal<IUserTrip[] | null> = signal(null);
  readonly trip: WritableSignal<Trip | null> = signal(null);
  private loadingTripId = signal<string | null>(null);
  readonly plan: WritableSignal<Plan | null> = signal(null);
  private loadingPlanId = signal<string | null>(null);

  plans = computed(() => {
    const plans = this.trips()?.find(trip => trip.id === this.trip()?.id)?.plans;
    return plans ?? [];
  });

  readonly selectedVisit: WritableSignal<Visit | null> = signal(null);
  readonly hoveredPlace: WritableSignal<Place | null> = signal(null);
  readonly selectedRoute: WritableSignal<Route | null> = signal(null);
  readonly hoveredRoute: WritableSignal<Route | null> = signal(null);
  drawingState = signal<DrawingState>({ active: false, sourceVisit: null });

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
    if (this.loadingTripId() === tripId) return EMPTY;
    console.log('load trip', tripId);
    this.loadingPlanId.set(tripId);
    this.clearTrip();
    return forkJoin({
      t: this.apiService.getTrip(tripId),
      p: this.apiService.getPlaces(tripId),
      r: this.apiService.getRoutes(tripId),
      c: this.apiService.getCountries(),
      s: this.apiService.getSeasons()
    }).pipe(
      map(data => {
        const countries = data.c.map(x => new Country(x));
        const seasons = data.s.map(x => new Season(x));
        const places = data.p.map(rawPlace => new Place(rawPlace, this));
        const routes = data.r.map(rawRoute => new Route(rawRoute, this));
        return new Trip(data.t, countries, seasons, places, routes, this);
      }),
      tap(trip => this.trip.set(trip)),
      catchError(err => {
        console.error('Failed to load trip:', err);
        return throwError(() => err);
      }),
      finalize(() => this.loadingTripId.set(null))
    );
  }

  loadPlan(planId: string): Observable<Plan> {
    if (this.loadingPlanId() === planId) return EMPTY;
    console.log('load plan', planId);
    this.loadingPlanId.set(planId);
    this.clearPlan();
    return forkJoin({
      p: this.apiService.getPlan(planId),
      v: this.apiService.getVisits(planId),
      t: this.apiService.getTraverses(planId)
    }).pipe(
      map(data => {
        const visits: Visit[] = data.v.map(v => new Visit(v, this));
        const traverses: Traverse[] = data.t.map(t => new Traverse(t, this));
        return new Plan(data.p, visits, traverses);
      }),
      tap(plan => {
        this.plan.set(plan);
      }),
      catchError(err => {
        console.error('Failed to load plan:', err);
        return throwError(() => err);
      }),
      finalize(() => this.loadingPlanId.set(null))
    );
  }

  test(planId: string) {
    this.apiService.getPlan(planId).pipe(
      switchMap(rawPlan => {
        return this.apiService.getVisits(planId).pipe(
          map(rawVisits => {
            const visits: Visit[] = rawVisits.map(v => new Visit(v, this));
            const traverses: Traverse[] = []; // TODO extract from api result.
            return new Plan(rawPlan, visits, traverses);
          })
        );
      })
    ).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loadingPlanId.set(null);
      },
      error: () => this.loadingPlanId.set(null)
    } );
  }

  addPlace(data: NewPlace) {
    return this.persist(
      this.apiService.createPlace(data),
      (placeData: IPlaceWithCountry) => {
        const trip = this.trip();
        if (!trip) return;
        const place = new Place(placeData, this);
        if (placeData.country) {
          trip.addCountry(new Country(placeData.country));
        }
        trip.addPlace(place);
      }
    );
  }

  removePlace(place: Place) {
    return this.persist(
      this.apiService.deletePlace(place.id),
      () => this.trip()?.removePlace(place)
    );
  }

  linkSeasonToPlace(place: Place, season: Season) {
    place.season_id = season.id;      // update the id
    this.trip()?.addSeason(season);    // ensure the Trip knows about it
  }

  async addVisit(data: NewVisit) {
    // TODO properly implement, use this.persist(...) and apiService.createVisit(...)
    const plan = this.plan();
    if (!plan) return;
    const newVisit = new Visit({id: 'new', ...data}, this);
    plan.addVisit(newVisit);
    return newVisit;
  }

  async createTraverse(routeType: RouteType, sourceId?: string, targetId?: string) {
    console.log(`TODO: create traverse from ${sourceId} to ${targetId} by ${routeType}`);
  }

  private persist<T>(
    request$: Observable<T>,
    onSuccess: (result: T) => void
  ): Observable<T> {
    return request$.pipe(
      tap(onSuccess)
    );
  }
}
