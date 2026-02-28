import {IPlace, Place} from './place';
import {computed, signal} from '@angular/core';
import {ISeason, Season} from './season';
import {Country, ICountry} from './country';
import {IRoute, Route} from './route';
import {TripService} from '../services/trip';
import {Activity, IActivity} from './activity';
import {IPlaceNote, PlaceNote} from './place-note';
import {IRouteNote, RouteNote} from './route-note';
import {CountryNote, ICountryNote} from './country-note';

export interface TripDataPackage {
  readonly trip: ITrip;
  readonly places: IPlace[];
  readonly activities: IActivity[];
  readonly placeNotes: IPlaceNote[];
  readonly routes: IRoute[];
  readonly routeNotes: IRouteNote[];
  readonly countries: ICountry[];
  readonly countryNotes: ICountryNote[];
  readonly seasons: ISeason[];
}

export interface ITrip {
  id: string;
  name: string;
}

export type NewTrip = Omit<ITrip, 'id'>;
export type UpdateTrip = Partial<Omit<ITrip, 'id'>>;

export class Trip {
  id!: string;
  name = signal<string>('');

  readonly countries = signal<Map<string, Country>>(new Map());
  readonly countryNotes = signal<Map<string, CountryNote>>(new Map());
  readonly seasons = signal<Map<string, Season>>(new Map());
  readonly places = signal<Map<string, Place>>(new Map());
  readonly placesArray = computed(() => Array.from(this.places().values()));
  readonly activities = signal<Map<string, Activity>>(new Map());
  readonly placeNotes = signal<Map<string, PlaceNote>>(new Map());
  readonly routes = signal<Map<string, Route>>(new Map());
  readonly routesArray = computed(() => Array.from(this.routes().values()));
  readonly routeNotes = signal<Map<string, RouteNote>>(new Map());

  readonly routesGeoJson = computed(() => {
    const routes = this.routes() ?? new Map();
    return {
      type: 'FeatureCollection' as const,
      features: Array.from(routes.values()).map((route: Route) => ({
        type: 'Feature' as const,
        id: Number(route.id),
        properties: {
          type: route.type(),
          routeId: route.id
        },
        geometry: {
          type: 'MultiLineString' as const,
          coordinates: route.routeSpline()
        }
      }))
    };
  });

  constructor(
    data: ITrip,
    countries: Country[],
    countryNotes: CountryNote[],
    seasons: Season[],
    places: Place[],
    activities: Activity[],
    placeNotes: PlaceNote[],
    routes: Route[],
    routeNotes: RouteNote[],
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.update(data);
    this.countries.set(new Map(countries.map(c => [c.id, c])));
    this.countryNotes.set(new Map(countryNotes.map(n => [n.id, n])));
    this.seasons.set(new Map(seasons.map(s => [s.id, s])));
    this.places.set(new Map(places.map(p => [p.id, p])));
    this.activities.set(new Map(activities.map(a => [a.id, a])));
    this.placeNotes.set(new Map(placeNotes.map(n => [n.id, n])));
    this.routes.set(new Map(routes.map(r => [r.id, r])));
    this.routeNotes.set(new Map(routeNotes.map(n => [n.id, n])));
  }

  update(data: Partial<ITrip>) {
    if ('name' in data) this.name.set(data.name ?? '');
  }

  addCountry(country: Country) {
    this.countries.update(cs => { const newMap = new Map(cs); newMap.set(country.id, country); return newMap; });
  }

  removeCountry(country: Country) {
    this.countries.update(cs => { const newMap = new Map(cs); newMap.delete(country.id); return newMap; });
    this.countryNotes.set(new Map(
      [...this.countryNotes().entries()].filter(([id, countryNote]) => countryNote.country_id !== country.id)
    ));
  }

  addCountryNote(note: CountryNote) {
    this.countryNotes.update(ns => { const newMap = new Map(ns); newMap.set(note.id, note); return newMap; });
  }

  removeCountryNote(note: CountryNote) {
    this.countryNotes.update(ns => { const newMap = new Map(ns); newMap.delete(note.id); return newMap; });
  }

  addSeason(season: Season) {
    this.seasons.update(ss => { const newMap = new Map(ss); newMap.set(season.id, season); return newMap; })
  }

  removeSeason(season: Season) {
    this.seasons.update(ss => { const newMap = new Map(ss); newMap.delete(season.id); return newMap; });
  }

  addPlace(place: Place) {
    this.places.update(ps => { const newMap = new Map(ps); newMap.set(place.id, place); return newMap; });
  }

  removePlace(place: Place): {
    activityIds: string[], placeNoteIds: string[], routeIds: string[], routeNoteIds: string[], visitIds: string[], traverseIds: string[]
  } {
    const routeIds: string[] = [];
    const routeNoteIds: string[] = [];
    const visitIds: string[] = [];
    const traverseIds: string[] = [];

    // 1. Remove the Place itself
    this.places.update(ps => { const newMap = new Map(ps); newMap.delete(place.id); return newMap; });
    const activityIds = Object.values(this.activities()).filter(a => a.place_id === place.id).map(a => a.id);
    const placeNoteIds = Object.values(this.placeNotes()).filter(n => n.place_id === place.id).map(n => n.id);

    const plan = this.tripService.plan();
    const nextTraverses = plan ? new Map(plan.traverses()) : null;

    // 2. Remove Visits and track their IDs
    if (plan) {
      const removedVisitIds = plan.removeVisitsByPlace(place);
      visitIds.push(...removedVisitIds);
      // If a traverse starts or ends at a deleted visit, it's an orphan
      if (nextTraverses) {
        nextTraverses.forEach((traverse, id) => {
          if (removedVisitIds.includes(traverse.source_visit_id) ||
              removedVisitIds.includes(traverse.target_visit_id)) {
            traverseIds.push(id);
            nextTraverses.delete(id);
          }
        });
      }
    }

    // 3. Cascade from Place to Routes to Traverses
    const currentRoutes = Array.from(this.routes().values());
    const routesToKeep = new Map(this.routes());
    currentRoutes.forEach(route => {
      if (route.sourceId === place.id || route.targetId === place.id) {
        routeIds.push(route.id);
        routesToKeep.delete(route.id);
        routeNoteIds.push(...Object.values(this.routeNotes()).filter(n => n.route_id === route.id).map(n => n.id));
        // Cascade from Route to Traverses
        if (nextTraverses) {
          route.traverses().forEach(traverse => {
            // Check if not already marked for deletion by the visit-check above
            if (nextTraverses.has(traverse.id)) {
              traverseIds.push(traverse.id);
              nextTraverses.delete(traverse.id);
            }
          });
        }
      }
    });

    // 4. Update the Signals
    this.routes.set(routesToKeep);
    if (plan && nextTraverses) {
      plan.traverses.set(nextTraverses);
    }

    // 5. Cleanup Country logic
    if (place.country && !Array.from(this.places().values()).some(p => p.country_id === place.country_id)) {
      this.removeCountry(place.country);
    }

    return { activityIds, placeNoteIds, routeIds, routeNoteIds, visitIds, traverseIds };
  }

  addActivity(activity: Activity) {
    this.activities.update(as => { const newMap = new Map(as); newMap.set(activity.id, activity); return newMap; });
  }

  removeActivity(activity: Activity) {
    this.activities.update(as => { const newMap = new Map(as); newMap.delete(activity.id); return newMap; });
  }

  addPlaceNote(note: PlaceNote) {
    this.placeNotes.update(ns => { const newMap = new Map(ns); newMap.set(note.id, note); return newMap; });
  }

  removePlaceNote(note: PlaceNote) {
    this.placeNotes.update(ns => { const newMap = new Map(ns); newMap.delete(note.id); return newMap; });
  }

  addRoute(route: Route) {
    this.routes.update(rs => { const newMap = new Map(rs); newMap.set(route.id, route); return newMap; });
  }

  removeRoute(route: Route): { routeNoteIds: string[], traverseIds: string[] } {
    const traverseIds: string[] = [];

    this.routes.update(rs => { const newMap = new Map(rs); newMap.delete(route.id); return newMap; });
    const routeNoteIds = Object.values(this.routeNotes()).filter(n => n.route_id === route.id).map(n => n.id);

    const plan = this.tripService.plan();
    if (plan) {
      const currentTraverses = Array.from(plan.traverses().values());
      const traversesToKeep = new Map(plan.traverses());
      currentTraverses.forEach(traverse => {
        if (traverse.route_id === route.id) {
          traverseIds.push(traverse.id);
          traversesToKeep.delete(traverse.id);
        }
      });
      plan.traverses.set(traversesToKeep);
    }

    return { routeNoteIds, traverseIds };
  }

  addRouteNote(note: RouteNote) {
    this.routeNotes.update(ns => { const newMap = new Map(ns); newMap.set(note.id, note); return newMap; });
  }

  removeRouteNote(note: RouteNote) {
    this.routeNotes.update(ns => { const newMap = new Map(ns); newMap.delete(note.id); return newMap; });
  }

  toJSON(): ITrip {
    return {
      id: this.id,
      name: this.name()
    } as ITrip
  }
}
