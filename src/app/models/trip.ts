import { Place } from './place';
import {computed, signal} from '@angular/core';
import { Season } from './season';
import { Country } from './country';
import {Route} from './route';
import {TripService} from '../services/trip';

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
  readonly seasons = signal<Map<string, Season>>(new Map());
  readonly places = signal<Map<string, Place>>(new Map());
  readonly placesArray = computed(() => Array.from(this.places().values()));
  readonly routes = signal<Map<string, Route>>(new Map());


  constructor(
    data: ITrip,
    countries: Country[],
    seasons: Season[],
    places: Place[],
    routes: Route[],
    private tripService: TripService
  ) {
    this.id = data.id;
    this.update(data);
    this.countries.set(new Map(countries.map(c => [c.id, c])));
    this.seasons.set(new Map(seasons.map(s => [s.id, s])));
    this.places.set(new Map(places.map(p => [p.id, p])));
    this.routes.set(new Map(routes.map(r => [r.id, r])));
  }

  update(data: Partial<ITrip>) {
    if ('name' in data) this.name.set(data.name ?? '');
  }

  addCountry(country: Country) {
    this.countries.update(cs => {
      cs.set(country.id, country);
      return cs;
    });
  }

  removeCountry(country: Country) {
    this.countries.update(cs => {
      cs.delete(country.id);
      return cs;
    });
  }

  addSeason(season: Season) {
    this.seasons.update(ss => {
      ss.set(season.id, season);
      return ss;
    });
  }

  removeSeason(season: Season) {
    this.seasons.update(ss => {
      ss.delete(season.id);
      return ss;
    });
  }

  addPlace(place: Place) {
    this.places.update(ps => {
      ps.set(place.id, place);
      return ps;
    });
  }

  removePlace(place: Place) {
    this.places.update(ps => {
      ps.delete(place.id);
      return ps;
    });
    this.tripService.plan()?.removeVisitsByPlace(place);
    if (place.country && !Array.from(this.places().values()).some(p => p.country_id === place.country_id)) {
      this.removeCountry(place.country);
    }
    Array.from(this.routes().values()).forEach(route => {
      if (route.sourceId === place.id || route.targetId === place.id) {
        this.removeRoute(route);
      }
    });
  }

  addRoute(route: Route) {
    this.routes.update(rs => {
      rs.set(route.id, route);
      return rs;
    });
  }

  removeRoute(route: Route) {
    this.routes.update(rs => {
      rs.delete(route.id);
      return rs;
    });
  }

  toJSON(): ITrip {
    return {
      id: this.id,
      name: this.name()
    } as ITrip
  }
}
