import {Injectable, inject, signal, WritableSignal, effect, computed, untracked} from '@angular/core';
import {
  Observable,
  tap,
  forkJoin,
  switchMap,
  catchError,
  throwError,
  finalize,
  EMPTY,
  of,
  filter,
  distinctUntilChanged, combineLatest, Subject
} from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api';
import {IUserPlan, IUserTrip, TripsDataPackage} from '../models/user';
import {ITrip, Trip, TripDataPackage} from '../models/trip';
import {IPlan, Plan, PlanDataPackage} from '../models/plan';
import {Country, ICountry} from '../models/country';
import {ISeason, Season} from '../models/season';
import {Place, NewPlace, UpdatePlace, IPlace} from '../models/place';
import {IVisit, NewVisit, UpdateVisit, Visit} from '../models/visit';
import { AuthService } from './auth';
import {ITraverse, NewTraverse, Traverse, UpdateTraverse} from '../models/traverse';
import {IRoute, NewRoute, Route, RouteType, UpdateRoute} from '../models/route';
import {ROUTE_ICONS} from '../components/map-handler/config/map-styles.config';
import {environment} from '../../environments/environment';
import {MockService} from './mock';
import {RoutingService} from './routing';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {NotificationService} from './notification';
import {Router} from '@angular/router';
import {CountryNote, ICountryNote, NewCountryNote, UpdateCountryNote} from '../models/country-note';
import {Activity, IActivity, NewActivity, UpdateActivity} from '../models/activity';
import {IPlaceNote, NewPlaceNote, PlaceNote, UpdatePlaceNote} from '../models/place-note';
import {IRouteNote, NewRouteNote, RouteNote, UpdateRouteNote} from '../models/route-note';


@Injectable({ providedIn: 'root' })
export class TripService {
  router = inject(Router);
  apiService = inject(ApiService);
  authService = inject(AuthService);
  mockService = inject(MockService);
  routingService = inject(RoutingService);
  notifierService = inject(NotificationService);

  private readonly resetInteractionSubject = new Subject<void>();
  readonly resetInteraction$ = this.resetInteractionSubject.asObservable();

  private triggerReset() {
    this.resetInteractionSubject.next();
  }

  private readonly refreshTripsTrigger = signal<number>(0);
  readonly trips = toSignal(
    combineLatest([
      toObservable(this.authService.user),
      toObservable(this.refreshTripsTrigger)
    ]).pipe(
      switchMap(([user, _refreshCount]) => {
        if (!user?.uid) return of([]);
        return this.loadTrips();
      }),
      catchError(err => of([]))
    ),
    { initialValue: [] }
  );

  private readonly tripId = signal<string | null>(null);
  private readonly planId = signal<string | null>(null);
  private readonly loadingTripId = signal<string | null>(null);
  private readonly loadingPlanId = signal<string | null>(null);

  readonly trip = toSignal(
    combineLatest([
      toObservable(this.tripId),
      toObservable(this.trips)
    ]).pipe(
      tap(() => this.triggerReset()),
      switchMap(([id, tripsSummary]) => {
        if (!id || !tripsSummary) return of(null);
        const tripExists = tripsSummary.some((t: any) => t.id === id);
        if (!tripExists && !environment.useMock) {
          console.warn(`Trip ID ${id} not found in user summary.`);
          this.notifierService.notify("This trip doesn't exist.", true);
          // this.router.navigate(['/']);
          return of(null);
        }
        return this.loadTrip(id);
      }),
      catchError((err) => {
        console.error('Error loading trip details:', err);
        return of(null);
      })
    ),
    { initialValue: null }
  );

  readonly plan = toSignal(
    combineLatest([
      toObservable(this.trip),
      toObservable(this.planId),
      toObservable(this.trips)
    ]).pipe(
      tap(() => this.triggerReset()),
      switchMap(([trip, planId, tripsSummary]) => {
        console.log('planId', planId, trip, trip?.id);
        if (!trip || !planId) return of(null);
        const planExists = tripsSummary.some(t => t.id === trip.id && t.plans.some(p => p.id === planId));
        if (!planExists && !environment.useMock) {
          console.warn(`Plan ${planId} does not belong to Trip ${trip.id}`);
          this.notifierService.notify("This plan doesn't exist in this trip.", true);
          // this.router.navigate(['/trip', trip.id]);
          return of(null);
        }
        return this.loadPlan(planId);
      }),
      catchError(() => of(null))
    ),
    { initialValue: null }
  );

  plans = computed(() => {
    const plans = this.trips()?.find(trip => trip.id === this.trip()?.id)?.plans;
    return plans ?? [];
  });

  constructor() {
    effect(() => {
      const userId = this.authService.user()?.uid;
      if (!userId) {
        untracked(() => this.resetState());
      }
    });
  }

  refreshTrips() { this.refreshTripsTrigger.update(n => n + 1) };
  setTripId(id: string | null) { this.tripId.set(id); }
  setPlanId(id: string | null) { this.planId.set(id); }

  private resetState() {
    console.log('User logged out - resetting ID sources');
    this.tripId.set(null);
    this.planId.set(null);
  }

  loadTrips(): Observable<IUserTrip[]> {
    const dataSource$: Observable<TripsDataPackage> = !environment.useMock
      ? this.apiService.get<TripsDataPackage>('trips')
      : this.mockService.fetchTripsMockAggregate();

    return dataSource$.pipe(
      map(data => {
        return data.trips.map(trip => ({
          id: trip.id.toString(),
          name: trip.name,
          plans: data.plans
            .filter((plan: any) => plan.trip_id.toString() === trip.id.toString())
            .map(plan => ({id: plan.id.toString(), name: plan.name, priority: plan.priority, trip_id: plan.trip_id.toString()}))
            .sort((a, b) => b.priority - a.priority)
        }));
      })
    )
  }

  // private createUserTrip(raw: any): IUserTrip {
  //   return {
  //     id: raw.id,
  //     name: raw.name,
  //     plans: (raw.plans || [])
  //       .map((p: any) => ({ id: p.id, name: p.name, priority: p.priority }))
  //       .sort((a: any, b: any) => a.priority - b.priority)
  //   };
  // }


  loadTrip(tripId: string): Observable<Trip> {
    if (this.loadingTripId() === tripId) return EMPTY;
    console.log('load trip', tripId);
    this.loadingTripId.set(tripId);

    const dataSource$: Observable<TripDataPackage> = !environment.useMock
      ? this.apiService.get<TripDataPackage>(`trips/${tripId}`)
      : this.mockService.fetchTripMockAggregate(tripId);

    return dataSource$.pipe(
      map(data => {
        console.log('Started mapping', data);
        const countries = data.countries.map(c => new Country(c, this));
        const countryNotes = data.countryNotes.map(n => new CountryNote(n, this));
        const seasons = data.seasons.map((s: any) => new Season(s));
        const places = data.places.map(p => new Place({...p, lng: p.lat, lat: p.lng}, this));
        const activities = data.activities.map(a => new Activity(a, this));
        const placeNotes = data.placeNotes.map(n => new PlaceNote(n, this));
        const routes = data.routes.map((r: any) => new Route({...r, target: r.destination}, this));
        const routeNotes = data.routeNotes.map(n => new RouteNote(n, this));
        return new Trip(data.trip, countries, countryNotes, seasons, places, activities, placeNotes, routes, routeNotes, this);
      }),
      finalize(() => this.loadingTripId.set(null))
    );
  }

  loadPlan(planId: string): Observable<Plan> {
    if (this.loadingPlanId() === planId) return EMPTY;
    console.log('load trip', planId);
    this.loadingPlanId.set(planId);

    const dataSource$: Observable<PlanDataPackage> = !environment.useMock
      ? this.apiService.get<PlanDataPackage>(`plans/${planId}`)
      : this.mockService.fetchPlanMockAggregate(planId);

    return dataSource$.pipe(
      map(data => {
        console.log('Started mapping', data);
        const visits = data.visits.map(v => new Visit(v, this));
        const traverses = data.traverses.map(t => new Traverse(t, this));
        return new Plan(data.plan, visits, traverses, this);
      }),
      finalize(() => this.loadingPlanId.set(null))
      // tap(plan => this.plan.set(plan)),
      // catchError(err => {
      //   console.error('Failed to load plan:', err);
      //   return throwError(() => err);
      // }),
      // finalize(() => this.loadingPlanId.set(null))
    );
  }

  addPlace(placeData: { name: string, lat: number, lng: number, countryName: string }): Observable<IPlace | null> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(null);

    console.log(!environment.useMock);
    const countryResolver$: Observable<Partial<ICountry>> = !environment.useMock
      ? of({ name: placeData.countryName })
      : this.mockService.resolveCountryMock(placeData.countryName);

    return countryResolver$.pipe(
      switchMap(country => {
        const newPlace: any = {
          ...placeData,
          lat: placeData.lng,
          lng: placeData.lat,
          countryName: placeData.countryName,
          trip_id: currentTrip.id,
          accommodation_cost: 0, food_cost: 0, miscellaneous_cost: 0
        };
        if (environment.useMock && country.id) {
          newPlace.country_id = country.id;
        }
        return this.persist(
          this.apiService.post<IPlace>('places', newPlace),
          (saved) => {
            if (!currentTrip.countries().has(saved.country_id)) currentTrip.addCountry(new Country({id: saved.country_id, name: placeData.countryName}, this))
            currentTrip.addPlace(new Place({
              ...saved,
              lat: saved.lng,
              lng: saved.lat
            }, this));
          }
        );
      })
    );
  }

  removePlace(place: Place): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);
    return this.persist(
      this.apiService.delete<void>(`places/${place.id}`),
      () => {
      const { activityIds, placeNoteIds, routeIds, routeNoteIds, visitIds, traverseIds } = currentTrip.removePlace(place);
      if (environment.useMock) {
        this.mockService.cleanupMockOrphans(activityIds, placeNoteIds, routeIds, routeNoteIds, visitIds, traverseIds);
      }
    });
  }

  updatePlace(id: string, updates: UpdatePlace): Observable<IPlace | null> {
    const place = this.trip()?.places().get(id);
    console.log(place);
    if (!place) return of(null);

    return this.patchAndPersist<IPlace, UpdatePlace>(
      `places/${id}`,
      updates,
      (updatedData) => place.update(updates),
      {
        message: 'Place updated.',
        // The Undo action: call the create method with the backup data!
        // undoAction: () => this.addVisit(backup.place_id, backup.plan_id).subscribe()
      }
    );
  }

  addVisit(placeId: string): Observable<Visit | null> {
    const currentTrip = this.trip();
    const currentPlan = this.plan();
    if (!currentTrip || !currentPlan || !currentTrip.places().has(placeId)) {
      console.error('Cannot add visit: Trip, Plan, or Place missing.');
      return of(null);
    }
    const newVisitData: NewVisit = { place_id: placeId, plan_id: currentPlan.id, nights: 0, included: true };
    return this.persist(
      this.apiService.post<IVisit>('visits', newVisitData),
      (saved) => currentPlan.addVisit(new Visit(saved, this))
    ).pipe(
      map(saved => new Visit(saved, this)),
      catchError(() => of(null))
    );
  }

  removeVisit(visit: Visit): Observable<void> {
    const currentPlan = this.plan();
    if (!currentPlan) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`visits/${visit.id}`),
      () => {
        const { traverseIds } = currentPlan.removeVisit(visit);
        if (environment.useMock) {
          this.mockService.cleanupMockOrphans([], [], [], [], [], traverseIds);
        }
      }
    );
  }

  updateVisit(id: string, updates: UpdateVisit): Observable<IVisit | null> {
    const visit = this.plan()?.visits().get(id);
    if (!visit) return of(null);

    return this.patchAndPersist<IVisit, UpdateVisit>(
      `visits/${id}`,
      updates,
      (updatedData) => visit.update(updates),
      {
        message: 'Visit updated.',
        // The Undo action: call the create method with the backup data!
        // undoAction: () => this.addVisit(backup.place_id, backup.plan_id).subscribe()
      }
    );
  }

  addRoute(sourceId: string, targetId: string, type: RouteType = 'driving'): Observable<Route | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(sourceId) || !currentTrip.places().has(targetId)) {
      return of(null);
    }
    const existingRoute = Array.from(currentTrip.routes().values())
      .find(r => r.sourceId === sourceId && r.targetId === targetId);
    if (existingRoute) return of(existingRoute);

    const newRouteData: any = {
      source: sourceId,
      destination: targetId,
      trip_id: currentTrip.id,
      type: type,
      distance: 0, duration: 0, estimated_cost: 0, nights: 0, route: '', actual_cost: 0, paid: false
    };

    return this.persist(
      this.apiService.post<IRoute>('routes', newRouteData),
      (saved) => currentTrip.addRoute(new Route(saved, this))
    ).pipe(
      map(saved => new Route(saved, this)),
      catchError(() => of(null))
    );
  }

  removeRoute(route: Route): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`routes/${route.id}`),
      () => {
        const { routeNoteIds, traverseIds } = currentTrip.removeRoute(route);
        if (environment.useMock) {
          this.mockService.cleanupMockOrphans([], [], [], routeNoteIds, [], traverseIds);
        }
      }
    );
  }

  updateRoute(id: string, updates: UpdateRoute): Observable<IRoute | null> {
    const route = this.trip()?.routes().get(id);
    if (!route) return of(null);

    const landModes: RouteType[] = ['driving', 'train', 'bus'];
    const needsEnrichment = updates.type && landModes.includes(updates.type) && !landModes.includes(route.type());
    const enrichment$: Observable<UpdateRoute> = needsEnrichment
      ? this.enrichRouteUpdates(route, updates)
      : of(updates);

    return enrichment$.pipe(
      switchMap(finalUpdates =>
        this.patchAndPersist<IRoute, UpdateRoute>(
          `routes/${id}`,
          finalUpdates,
          (updatedData) => route.update(updates)
        )
      ),
      catchError(() => of(null))
    );
  }

  private enrichRouteUpdates(route: Route, updates: UpdateRoute): Observable<UpdateRoute> {
    const source = route.source;
    const target = route.target;
    if (!source || !target) return of(updates);

    return this.routingService.getDirections(
      [source.lat, source.lng], // Check if your model uses .lat() or .lat
      [target.lat, target.lng],
      updates.type!
    ).pipe(
      map(geo => ({
        ...updates,
        route: geo.geometry,
        distance: geo.distance,
        duration: geo.duration
      })),
      catchError(() => of(updates))
    );
  }

  addTraverse(sourceVisitId: string, targetVisitId: string, routeId: string, priority: number): Observable<Traverse | null> {
    const currentTrip = this.trip();
    const currentPlan = this.plan();
    if (!currentTrip || !currentPlan || !currentTrip.routes().has(routeId) || !currentPlan.visits().has(sourceVisitId) || !currentPlan.visits().has(targetVisitId)) {
      console.error('Cannot add traverse: Trip, Plan, Route, or connecting Visits missing.');
      return of(null);
    }

    const newTraverseData: NewTraverse = {
      source_visit_id: sourceVisitId,
      target_visit_id: targetVisitId,
      route_id: routeId,
      plan_id: currentPlan.id,
      priority: priority,
      rent_until: null, includes_accommodation: false, cost: 0, booked_days: 0
    };

    return this.persist(
      this.apiService.post<ITraverse>('traverses', newTraverseData),
      (saved) => currentPlan.addTraverse(new Traverse(saved, this))
    ).pipe(
      map(saved => new Traverse(saved, this)),
      catchError(() => of(null))
    );
  }

  removeTraverse(traverse: Traverse): Observable<void> {
    const currentPlan = this.plan();
    if (!currentPlan) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`traverses/${traverse.id}`),
      () => currentPlan.removeTraverse(traverse)
    );
  }

  updateTraverse(id: string, updates: UpdateTraverse): Observable<ITraverse | null> {
    const traverse = this.plan()?.traverses().get(id);
    if (!traverse) return of(null);

    return this.patchAndPersist<ITraverse, UpdateTraverse>(
      `traverses/${id}`,
      updates,
      (updatedData) => traverse.update(updates)
    );
  }

  addActivity(placeId: string, description: string = ''): Observable<Activity | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot add activity: Trip, or Place missing.');
      return of(null);
    }
    const newActivityData: NewActivity = { place_id: placeId, trip_id: currentTrip.id, description: description, category: 'undefined', included: true, estimated_cost: 0 };
    return this.persist(
      this.apiService.post<IActivity>('activities', newActivityData),
      (saved) => currentTrip.addActivity(new Activity(saved, this))
    ).pipe(
      map(saved => new Activity(saved, this)),
      catchError(() => of(null))
    );
  }

  removeActivity(activity: Activity): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`activities/${activity.id}`),
      () => currentTrip.removeActivity(activity)
    );
  }

  updateActivity(id: string, updates: UpdateActivity): Observable<IActivity | null> {
    const activity = this.trip()?.activities().get(id);
    if (!activity) return of(null);

    return this.patchAndPersist<IActivity, UpdateActivity>(
      `activities/${id}`,
      updates,
      (updatedData) => activity.update(updates),
      {
        message: 'Activity updated.'
      }
    );
  }

  fetchActivityDescriptions(placeId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot fetch activity descriptions: Trip, or Place missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`activities/${placeId}/place`),
      (descriptions) => {
        descriptions.forEach(descData => {
          currentTrip.activities().get(descData.id)?.update({description: descData.description});
        });
      },
      { message: 'Descriptions loaded' }
    );
  }

  addPlaceNote(placeId: string): Observable<PlaceNote | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot add place note: Trip, or Place missing.');
      return of(null);
    }
    const newPlaceNoteData: NewPlaceNote = { place_id: placeId, trip_id: currentTrip.id, description: '', category: null, included: true, estimated_cost: 0 };
    return this.persist(
      this.apiService.post<IPlaceNote>('place_notes', newPlaceNoteData),
      (saved) => currentTrip.addPlaceNote(new PlaceNote(saved, this))
    ).pipe(
      map(saved => new PlaceNote(saved, this)),
      catchError(() => of(null))
    );
  }

  removePlaceNote(placeNote: PlaceNote): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`place_notes/${placeNote.id}`),
      () => currentTrip.removePlaceNote(placeNote)
    );
  }

  updatePlaceNote(id: string, updates: UpdatePlaceNote): Observable<IPlaceNote | null> {
    const placeNote = this.trip()?.placeNotes().get(id);
    if (!placeNote) return of(null);

    return this.patchAndPersist<IPlaceNote, UpdatePlaceNote>(
      `place_notes/${id}`,
      updates,
      (updatedData) => placeNote.update(updates),
      {
        message: 'Place note updated.'
      }
    );
  }

  fetchPlaceNoteDescriptions(placeId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot fetch place note descriptions: Trip, or Place missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`place_notes/place/${placeId}`),
      (descriptions) => {
        descriptions.forEach(descData => {
          currentTrip.placeNotes().get(descData.id)?.description.set(descData.description);
        });
      },
      { message: 'Descriptions loaded' }
    );
  }

  addCountryNote(countryId: string): Observable<CountryNote | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.countries().has(countryId)) {
      console.error('Cannot add country note: Trip, or Country missing.');
      return of(null);
    }
    const newCountryNoteData: NewCountryNote = { country_id: countryId, trip_id: currentTrip.id, description: '', category: null, included: true, estimated_cost: 0 };
    return this.persist(
      this.apiService.post<ICountryNote>('country_notes', newCountryNoteData),
      (saved) => currentTrip.addCountryNote(new CountryNote(saved, this))
    ).pipe(
      map(saved => new CountryNote(saved, this)),
      catchError(() => of(null))
    );
  }

  removeCountryNote(countryNote: CountryNote): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`country_notes/${countryNote.id}`),
      () => currentTrip.removeCountryNote(countryNote)
    );
  }

  updateCountryNote(id: string, updates: UpdateCountryNote): Observable<ICountryNote | null> {
    const countryNote = this.trip()?.countryNotes().get(id);
    if (!countryNote) return of(null);

    return this.patchAndPersist<ICountryNote, UpdateCountryNote>(
      `country_notes/${id}`,
      updates,
      (updatedData) => countryNote.update(updates),
      {
        message: 'Country note updated.'
      }
    );
  }

  fetchCountryNoteDescriptions(countryId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.countries().has(countryId)) {
      console.error('Cannot fetch country note descriptions: Trip, or Country missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`country_notes/country/${countryId}`),
      (descriptions) => {
        descriptions.forEach(descData => {
          currentTrip.countryNotes().get(descData.id)?.description.set(descData.description);
        });
      },
      { message: 'Descriptions loaded' }
    );
  }

  addRouteNote(routeId: string): Observable<RouteNote | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.routes().has(routeId)) {
      console.error('Cannot add country note: Trip, or Route missing.');
      return of(null);
    }
    const newRouteNoteData: NewRouteNote = { route_id: routeId, trip_id: currentTrip.id, description: '' };
    return this.persist(
      this.apiService.post<IRouteNote>('route_notes', newRouteNoteData),
      (saved) => currentTrip.addRouteNote(new RouteNote(saved, this))
    ).pipe(
      map(saved => new RouteNote(saved, this)),
      catchError(() => of(null))
    );
  }

  removeRouteNote(routeNote: RouteNote): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`route_notes/${routeNote.id}`),
      () => currentTrip.removeRouteNote(routeNote)
    );
  }

  updateRouteNote(id: string, updates: UpdateRouteNote): Observable<IRouteNote | null> {
    const routeNote = this.trip()?.routeNotes().get(id);
    if (!routeNote) return of(null);

    return this.patchAndPersist<IRouteNote, UpdateRouteNote>(
      `route_notes/${id}`,
      updates,
      (updatedData) => routeNote.update(updates),
      {
        message: 'Route note updated.'
      }
    );
  }

  fetchRouteNoteDescriptions(routeId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.routes().has(routeId)) {
      console.error('Cannot fetch route note descriptions: Trip, or Route missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`route_notes/route/${routeId}`),
      (descriptions) => {
        descriptions.forEach(descData => {
          currentTrip.routeNotes().get(descData.id)?.description.set(descData.description);
        });
      },
      { message: 'Descriptions loaded' }
    );
  }

  // TODO check if necessary, or seasons are handled by computed()s.
  linkSeasonToPlace(place: Place, season: Season) {
    place.season_id = season.id;      // update the id
    this.trip()?.addSeason(season);    // ensure the Trip knows about it
  }

  private patchAndPersist<T, U>(
    endpoint: string,
    updates: U,
    onSuccess: (data: T) => void,
    options?: {
      message?: string;
      undoAction?: () => void;
    }
  ): Observable<T> {
    const request$ = this.apiService.patch<T>(endpoint, updates);
    return this.persist(request$, onSuccess, options);
  }

  private persist<T>(
    request$: Observable<T>,
    onSuccess: (result: T) => void,
    options?: {
      message?: string;
      undoAction?: () => void;
    }
  ): Observable<T> {
    return request$.pipe(
      tap({
        next: (result) => {
          onSuccess(result);
          this.notifierService.notify(options?.message ?? 'Success', false, options?.undoAction);
        },
        error: (err) => {
          console.error('Persistence failed:', err);
          this.notifierService.notify('An error occurred. Please try again.', true);
        }
      })
    );
  }
}
