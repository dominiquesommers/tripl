import {Injectable, inject, signal, effect, computed, untracked} from '@angular/core';
import {
  Observable, tap, forkJoin, switchMap, catchError, throwError,
  finalize, EMPTY, of, filter, distinctUntilChanged, combineLatest, Subject
} from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api';
import {IUserPlan, IUserTrip, TripsDataPackage} from '../models/user';
import {ITrip, Trip, TripDataPackage} from '../models/trip';
import {IPlan, PersistentUpdatePlan, Plan, PlanDataPackage, UpdatePlan} from '../models/plan';
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
import {Expense, IExpense, NewExpense, UpdateExpense} from '../models/expense';
import {IPlaceBooking, NewPlaceBooking, PlaceBooking, UpdatePlaceBooking} from '../models/place-booking';
import {IRouteBooking, NewRouteBooking, RouteBooking, UpdateRouteBooking} from '../models/route-booking';

export type ExpenseOwnerType =
  | 'activity'
  | 'place_note'
  | 'country_note'
  | 'trip_note'
  | 'place_booking'
  | 'route_booking'
  | 'place';

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

  refreshTrips() { this.refreshTripsTrigger.update(n => n + 1); }
  setTripId(id: string | null) { this.tripId.set(id); }
  setPlanId(id: string | null) { this.planId.set(id); }

  private resetState() {
    console.log('User logged out - resetting ID sources');
    this.tripId.set(null);
    this.planId.set(null);
  }

  // ── LOAD ─────────────────────────────────────────────────────────────────

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
            .map(plan => ({
              id: plan.id.toString(),
              name: plan.name,
              priority: plan.priority,
              trip_id: plan.trip_id.toString()
            }))
            .sort((a, b) => b.priority - a.priority)
        }));
      })
    );
  }

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
        const countries     = data.countries.map(c => new Country(c, this));
        const countryNotes  = data.countryNotes.map(n => new CountryNote(n, this));
        const seasons       = data.seasons.map((s: any) => new Season(s, this));
        const places        = data.places.map(p => new Place({...p, lng: p.lat, lat: p.lng}, this));
        const activities    = data.activities.map(a => new Activity(a, this));
        const placeNotes    = data.placeNotes.map(n => new PlaceNote(n, this));
        const routes        = data.routes.map((r: any) => new Route({...r, target: r.destination}, this));
        const routeNotes    = data.routeNotes.map(n => new RouteNote(n, this));
        const expenses      = (data.expenses ?? []).map(e => new Expense(e, this));
        const placeBookings = (data.placeBookings ?? []).map(b => new PlaceBooking(b, this));
        const routeBookings = (data.routeBookings ?? []).map(b => new RouteBooking(b, this));
        return new Trip(
          data.trip, countries, countryNotes, seasons, places, activities,
          placeNotes, routes, routeNotes, expenses, placeBookings, routeBookings, this
        );
      }),
      finalize(() => this.loadingTripId.set(null))
    );
  }

  loadPlan(planId: string): Observable<Plan> {
    if (this.loadingPlanId() === planId) return EMPTY;
    console.log('load plan', planId);
    this.loadingPlanId.set(planId);

    const dataSource$: Observable<PlanDataPackage> = !environment.useMock
      ? this.apiService.get<PlanDataPackage>(`plans/${planId}`)
      : this.mockService.fetchPlanMockAggregate(planId);

    return dataSource$.pipe(
      map(data => {
        console.log('Started mapping', data);
        const visits    = data.visits.map(v => new Visit(v, this));
        const traverses = data.traverses.map(t => new Traverse(t, this));
        return new Plan(data.plan, visits, traverses, this);
      }),
      finalize(() => this.loadingPlanId.set(null))
    );
  }

  // ── TRIPS ─────────────────────────────────────────────────────────────────

  updateTrip(id: string, updates: UpdatePlan): Observable<ITrip | null> {
    return this.patchAndPersist<ITrip, UpdatePlan>(
      `trips/${id}`,
      updates,
      () => this.trip()?.update(updates),
      { message: 'Trip updated.' }
    );
  }

  // ── PLANS ─────────────────────────────────────────────────────────────────

  updatePlanSilently(id: string, updates: PersistentUpdatePlan) {
    const currentPlan = this.plan();
    if (currentPlan && currentPlan.id === id) {
      currentPlan.update(updates);
    }
    this.apiService.fireAndForget(`plans/${id}`, updates);
  }

  updatePlan(id: string, updates: UpdatePlan): Observable<IPlan | null> {
    return this.patchAndPersist<IPlan, UpdatePlan>(
      `plans/${id}`,
      updates,
      () => { return; },
      { message: 'Plan updated.' }
    );
  }

  // ── PLACES ────────────────────────────────────────────────────────────────

  addPlace(placeData: { name: string, lat: number, lng: number, countryName: string }): Observable<IPlace | null> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(null);

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
            if (!currentTrip.countries().has(saved.country_id)) {
              currentTrip.addCountry(new Country({id: saved.country_id, name: placeData.countryName}, this));
            }
            currentTrip.addPlace(new Place({...saved, lat: saved.lng, lng: saved.lat}, this));
          },
          { message: `${placeData.name} added to your trip.` }
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
        const { activityIds, placeNoteIds, routeIds, routeNoteIds, visitIds, traverseIds } =
          currentTrip.removePlace(place);
        if (environment.useMock) {
          this.mockService.cleanupMockOrphans(activityIds, placeNoteIds, routeIds, routeNoteIds, visitIds, traverseIds);
        }
      },
      { message: `${place.name()} removed.` }
    );
  }

  updatePlace(id: string, updates: UpdatePlace): Observable<IPlace | null> {
    const place = this.trip()?.places().get(id);
    if (!place) return of(null);

    return this.patchAndPersist<IPlace, UpdatePlace>(
      `places/${id}`,
      updates,
      () => place.update(updates),
      { message: 'Place updated.' }
    );
  }

  // ── VISITS ────────────────────────────────────────────────────────────────

  addVisit(placeId: string): Observable<Visit | null> {
    const currentTrip = this.trip();
    const currentPlan = this.plan();
    if (!currentTrip || !currentPlan || !currentTrip.places().has(placeId)) {
      console.error('Cannot add visit: Trip, Plan, or Place missing.');
      return of(null);
    }
    const place = currentTrip.places().get(placeId);
    const newVisitData: NewVisit = { place_id: placeId, plan_id: currentPlan.id, nights: 0, included: true };

    return this.persist(
      this.apiService.post<IVisit>('visits', newVisitData),
      (saved) => currentPlan.addVisit(new Visit(saved, this)),
      { message: `${place?.name()} added to plan.` }
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
      },
      { message: 'Visit removed from plan.' }
    );
  }

  updateVisit(id: string, updates: UpdateVisit): Observable<IVisit | null> {
    const visit = this.plan()?.visits().get(id);
    if (!visit) return of(null);

    return this.patchAndPersist<IVisit, UpdateVisit>(
      `visits/${id}`,
      updates,
      () => visit.update(updates)
    );
  }

  // ── ROUTES ────────────────────────────────────────────────────────────────

  addRoute(sourceId: string, targetId: string, type: RouteType = 'driving'): Observable<Route | null> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(null);
    const source = currentTrip.places().get(sourceId);
    const target = currentTrip.places().get(targetId);
    if (!source || !target) return of(null);

    const existingRoute = Array.from(currentTrip.routes().values())
      .find(r => r.sourceId === sourceId && r.targetId === targetId);
    if (existingRoute) return of(existingRoute);

    const routeString = `[[${source.lat},${source.lng}}],[${target.lat},${target.lng}]]`;
    const newRouteData: any = {
      source: sourceId,
      destination: targetId,
      trip_id: currentTrip.id,
      type,
      distance: 0, duration: 0, estimated_cost: 0, nights: 0,
      route: routeString, actual_cost: 0, paid: false
    };

    return this.persist(
      this.apiService.post<IRoute>('routes', newRouteData),
      (saved) => currentTrip.addRoute(new Route(saved, this)),
      { message: `Route from ${source.name()} to ${target.name()} added.` }
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
      },
      { message: 'Route removed.' }
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
          () => route.update(updates),
          { message: 'Route updated.' }
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
      [source.lat, source.lng],
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

  // ── TRAVERSES ─────────────────────────────────────────────────────────────

  addTraverse(sourceVisitId: string, targetVisitId: string, routeId: string, priority: number): Observable<Traverse | null> {
    const currentTrip = this.trip();
    const currentPlan = this.plan();
    if (!currentTrip || !currentPlan ||
        !currentTrip.routes().has(routeId) ||
        !currentPlan.visits().has(sourceVisitId) ||
        !currentPlan.visits().has(targetVisitId)) {
      console.error('Cannot add traverse: Trip, Plan, Route, or connecting Visits missing.');
      return of(null);
    }

    const newTraverseData: NewTraverse = {
      source_visit_id: sourceVisitId,
      target_visit_id: targetVisitId,
      route_id: routeId,
      plan_id: currentPlan.id,
      priority,
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
      () => traverse.update(updates)
    );
  }

  // ── ACTIVITIES ────────────────────────────────────────────────────────────

  addActivity(placeId: string, description: string = ''): Observable<Activity | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot add activity: Trip or Place missing.');
      return of(null);
    }
    const newActivityData: NewActivity = {
      place_id: placeId, trip_id: currentTrip.id,
      description, category: 'undefined', included: true, estimated_cost: 0
    };

    return this.persist(
      this.apiService.post<IActivity>('activities', newActivityData),
      (saved) => currentTrip.addActivity(new Activity(saved, this)),
      { message: 'Activity added.' }
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
      () => currentTrip.removeActivity(activity),
      { message: 'Activity removed.' }
    );
  }

  updateActivity(id: string, updates: UpdateActivity): Observable<IActivity | null> {
    const activity = this.trip()?.activities().get(id);
    if (!activity) return of(null);

    return this.patchAndPersist<IActivity, UpdateActivity>(
      `activities/${id}`,
      updates,
      () => activity.update(updates)
    );
  }

  fetchActivityDescriptions(placeId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot fetch activity descriptions: Trip or Place missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`activities/${placeId}/place`),
      (descriptions) => {
        descriptions.forEach(d => currentTrip.activities().get(d.id)?.update({ description: d.description }));
      }
    );
  }

  // ── PLACE NOTES ───────────────────────────────────────────────────────────

  addPlaceNote(placeId: string, description: string = ''): Observable<PlaceNote | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot add place note: Trip or Place missing.');
      return of(null);
    }
    const newPlaceNoteData: NewPlaceNote = {
      place_id: placeId, trip_id: currentTrip.id,
      description, category: 'undefined', included: true, estimated_cost: 0
    };

    return this.persist(
      this.apiService.post<IPlaceNote>('place_notes', newPlaceNoteData),
      (saved) => currentTrip.addPlaceNote(new PlaceNote(saved, this)),
      { message: 'Note added.' }
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
      () => currentTrip.removePlaceNote(placeNote),
      { message: 'Note removed.' }
    );
  }

  updatePlaceNote(id: string, updates: UpdatePlaceNote): Observable<IPlaceNote | null> {
    const placeNote = this.trip()?.placeNotes().get(id);
    if (!placeNote) return of(null);

    return this.patchAndPersist<IPlaceNote, UpdatePlaceNote>(
      `place_notes/${id}`,
      updates,
      () => placeNote.update(updates)
    );
  }

  fetchPlaceNoteDescriptions(placeId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot fetch place note descriptions: Trip or Place missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`place_notes/${placeId}/place`),
      (descriptions) => {
        descriptions.forEach(d => currentTrip.placeNotes().get(d.id)?.description.set(d.description));
      }
    );
  }

  // ── COUNTRY NOTES ─────────────────────────────────────────────────────────

  addCountryNote(countryId: string, description: string = ''): Observable<CountryNote | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.countries().has(countryId)) {
      console.error('Cannot add country note: Trip or Country missing.');
      return of(null);
    }
    const newCountryNoteData: NewCountryNote = {
      country_id: countryId, trip_id: currentTrip.id,
      description, category: 'undefined', included: true, estimated_cost: 0
    };

    return this.persist(
      this.apiService.post<ICountryNote>('country_notes', newCountryNoteData),
      (saved) => currentTrip.addCountryNote(new CountryNote(saved, this)),
      { message: 'Country note added.' }
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
      () => currentTrip.removeCountryNote(countryNote),
      { message: 'Country note removed.' }
    );
  }

  updateCountryNote(id: string, updates: UpdateCountryNote): Observable<ICountryNote | null> {
    const countryNote = this.trip()?.countryNotes().get(id);
    if (!countryNote) return of(null);

    return this.patchAndPersist<ICountryNote, UpdateCountryNote>(
      `country_notes/${id}`,
      updates,
      () => countryNote.update(updates)
    );
  }

  fetchCountryNoteDescriptions(countryId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.countries().has(countryId)) {
      console.error('Cannot fetch country note descriptions: Trip or Country missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`country_notes/${countryId}/country`),
      (descriptions) => {
        descriptions.forEach(d => currentTrip.countryNotes().get(d.id)?.description.set(d.description));
      }
    );
  }

  // ── ROUTE NOTES ───────────────────────────────────────────────────────────

  addRouteNote(routeId: string, description: string = ''): Observable<RouteNote | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.routes().has(routeId)) {
      console.error('Cannot add route note: Trip or Route missing.');
      return of(null);
    }
    const newRouteNoteData: NewRouteNote = {
      route_id: routeId, trip_id: currentTrip.id, description
    };

    return this.persist(
      this.apiService.post<IRouteNote>('route_notes', newRouteNoteData),
      (saved) => currentTrip.addRouteNote(new RouteNote(saved, this)),
      { message: 'Route note added.' }
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
      () => currentTrip.removeRouteNote(routeNote),
      { message: 'Route note removed.' }
    );
  }

  updateRouteNote(id: string, updates: UpdateRouteNote): Observable<IRouteNote | null> {
    const routeNote = this.trip()?.routeNotes().get(id);
    if (!routeNote) return of(null);

    return this.patchAndPersist<IRouteNote, UpdateRouteNote>(
      `route_notes/${id}`,
      updates,
      () => routeNote.update(updates)
    );
  }

  fetchRouteNoteDescriptions(routeId: string): Observable<{id: string, description: string}[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.routes().has(routeId)) {
      console.error('Cannot fetch route note descriptions: Trip or Route missing.');
      return of([]);
    }
    return this.persist(
      this.apiService.get<{id: string, description: string}[]>(`route_notes/${routeId}/route`),
      (descriptions) => {
        descriptions.forEach(d => currentTrip.routeNotes().get(d.id)?.description.set(d.description));
      }
    );
  }

  // ── EXPENSES ──────────────────────────────────────────────────────────────

  addExpense(payload: NewExpense): Observable<Expense | null> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(null);

    return this.persist(
      this.apiService.post<IExpense>('expenses', payload),
      (saved) => currentTrip.addExpense(new Expense(saved, this)),
      { message: 'Payment added.' }
    ).pipe(
      map(saved => new Expense(saved, this)),
      catchError(() => of(null))
    );
  }

  removeExpense(expense: Expense): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`expenses/${expense.id}`),
      () => currentTrip.removeExpense(expense),
      { message: 'Payment removed.' }
    );
  }

  updateExpense(id: string, updates: UpdateExpense): Observable<IExpense | null> {
    const expense = this.trip()?.expenses().get(id);
    if (!expense) return of(null);

    return this.patchAndPersist<IExpense, UpdateExpense>(
      `expenses/${id}`,
      updates,
      () => expense.update(updates),
      { message: 'Payment updated.' }
    );
  }

  fetchExpenseDetails(ownerId: string, ownerType: ExpenseOwnerType): Observable<IExpense[]> {
    const currentTrip = this.trip();
    if (!currentTrip) return of([]);

    return this.persist(
      this.apiService.get<IExpense[]>(`expenses/${ownerId}/${ownerType}`),
      (expenses) => {
        expenses.forEach(e => {
          const existing = currentTrip.expenses().get(e.id);
          if (existing) {
            existing.update(e);
          } else {
            currentTrip.addExpense(new Expense(e, this));
          }
        });
      }
    );
  }

  // ── PLACE BOOKINGS ────────────────────────────────────────────────────────

  addPlaceBooking(placeId: string): Observable<PlaceBooking | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot add place booking: Trip or Place missing.');
      return of(null);
    }
    const place = currentTrip.places().get(placeId);
    const payload: NewPlaceBooking = {
      place_id: placeId, trip_id: currentTrip.id,
      check_in: null, check_out: null, final_price: null,
      includes_food: false, food_pct: 0,
      cancel_before: null, pay_by: null, is_tentative: false,
    };

    return this.persist(
      this.apiService.post<IPlaceBooking>('place_bookings', payload),
      (saved) => currentTrip.addPlaceBooking(new PlaceBooking(saved, this)),
      { message: `Booking added for ${place?.name()}.` }
    ).pipe(
      map(saved => new PlaceBooking(saved, this)),
      catchError(() => of(null))
    );
  }

  removePlaceBooking(booking: PlaceBooking): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`place_bookings/${booking.id}`),
      () => currentTrip.removePlaceBooking(booking),
      { message: 'Booking removed.' }
    ).pipe(
      catchError(err => {
        if (err.status === 409) {
          this.notifierService.notify(
            err.error?.message ?? 'Cannot delete booking — payments are linked to it. Remove them first.',
            true
          );
          return EMPTY;
        }
        return throwError(() => err);
      })
    );
  }

  updatePlaceBooking(id: string, updates: UpdatePlaceBooking): Observable<IPlaceBooking | null> {
    const booking = this.trip()?.placeBookings().get(id);
    if (!booking) return of(null);

    return this.patchAndPersist<IPlaceBooking, UpdatePlaceBooking>(
      `place_bookings/${id}`,
      updates,
      () => booking.update(updates),
      { message: 'Booking updated.' }
    );
  }

  fetchPlaceBookingDetails(placeId: string): Observable<IPlaceBooking[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.places().has(placeId)) {
      console.error('Cannot fetch place booking details: Trip or Place missing.');
      return of([]);
    }

    return this.persist(
      this.apiService.get<IPlaceBooking[]>(`place_bookings/place/${placeId}`),
      (bookings) => {
        bookings.forEach(b => {
          const existing = currentTrip.placeBookings().get(b.id);
          if (existing) existing.update(b);
          else currentTrip.addPlaceBooking(new PlaceBooking(b, this));
        });
      }
    );
  }

  // ── ROUTE BOOKINGS ────────────────────────────────────────────────────────

  addRouteBooking(routeId: string): Observable<RouteBooking | null> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.routes().has(routeId)) {
      console.error('Cannot add route booking: Trip or Route missing.');
      return of(null);
    }
    const route = currentTrip.routes().get(routeId);
    const payload: NewRouteBooking = {
      route_id: routeId, trip_id: currentTrip.id,
      departure_at: null, arrival_at: null, final_price: null,
      includes_accommodation: false, accommodation_pct: 0,
      includes_food: false, food_pct: 0,
      includes_activity: false, activity_pct: 0,
      cancel_before: null, pay_by: null, is_tentative: false,
    };

    return this.persist(
      this.apiService.post<IRouteBooking>('route_bookings', payload),
      (saved) => currentTrip.addRouteBooking(new RouteBooking(saved, this)),
      { message: 'Transport booking added.' }
    ).pipe(
      map(saved => new RouteBooking(saved, this)),
      catchError(() => of(null))
    );
  }

  removeRouteBooking(booking: RouteBooking): Observable<void> {
    const currentTrip = this.trip();
    if (!currentTrip) return of(undefined);

    return this.persist(
      this.apiService.delete<void>(`route_bookings/${booking.id}`),
      () => currentTrip.removeRouteBooking(booking),
      { message: 'Transport booking removed.' }
    ).pipe(
      catchError(err => {
        if (err.status === 409) {
          this.notifierService.notify(
            err.error?.message ?? 'Cannot delete booking — payments are linked to it. Remove them first.',
            true
          );
          return EMPTY;
        }
        return throwError(() => err);
      })
    );
  }

  updateRouteBooking(id: string, updates: UpdateRouteBooking): Observable<IRouteBooking | null> {
    const booking = this.trip()?.routeBookings().get(id);
    if (!booking) return of(null);

    return this.patchAndPersist<IRouteBooking, UpdateRouteBooking>(
      `route_bookings/${id}`,
      updates,
      () => booking.update(updates),
      { message: 'Transport booking updated.' }
    );
  }

  fetchRouteBookingDetails(routeId: string): Observable<IRouteBooking[]> {
    const currentTrip = this.trip();
    if (!currentTrip || !currentTrip.routes().has(routeId)) {
      console.error('Cannot fetch route booking details: Trip or Route missing.');
      return of([]);
    }

    return this.persist(
      this.apiService.get<IRouteBooking[]>(`route_bookings/route/${routeId}`),
      (bookings) => {
        bookings.forEach(b => {
          const existing = currentTrip.routeBookings().get(b.id);
          if (existing) existing.update(b);
          else currentTrip.addRouteBooking(new RouteBooking(b, this));
        });
      }
    );
  }

  // ── MISC ──────────────────────────────────────────────────────────────────

  linkSeasonToPlace(place: Place, season: Season) {
    place.season_id = season.id;
    this.trip()?.addSeason(season);
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────────

  private patchAndPersist<T, U>(
    endpoint: string,
    updates: U,
    onSuccess: (data: T) => void,
    options?: { message?: string; undoAction?: () => void; }
  ): Observable<T> {
    return this.persist(this.apiService.patch<T>(endpoint, updates), onSuccess, options);
  }

  private persist<T>(
    request$: Observable<T>,
    onSuccess: (result: T) => void,
    options?: { message?: string; undoAction?: () => void; }
  ): Observable<T> {
    return request$.pipe(
      tap({
        next: (result) => {
          onSuccess(result);
          if (options?.message) {
            this.notifierService.notify(options.message, false, options.undoAction);
          }
        },
        error: (err) => {
          console.error('Persistence failed:', err);
          this.notifierService.notify(
            err.error?.message ?? 'An error occurred. Please try again.',
            true
          );
        }
      })
    );
  }
}
