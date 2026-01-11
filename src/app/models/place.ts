import { Country, ICountry } from './country';
import { Season } from './season';
import { TripService } from '../services/trip';
import { signal, computed } from '@angular/core';
import {LngLatLike} from 'mapbox-gl';


export interface IPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country_id: string;
  season_id: string;
  trip_id: string;
  accommodation_cost?: number | null;
  food_cost?: number | null;
  miscellaneous_cost?: number | null;
}


export interface IPlaceWithCountry extends IPlace {
  country?: ICountry;
}


export type NewPlace = Omit<IPlace, 'id'>;
export type UpdatePlace = Partial<Omit<IPlace, 'id' | 'lat' | 'lng' | 'country_id' | 'season_id' | 'trip_id'>>;


export class Place {
  id!: string;
  lat!: number;
  lng!: number;
  country_id!: string;
  season_id?: string | null;
  trip_id!: string;
  name = signal<string>('');
  accommodation_cost = signal<number>(0);
  food_cost= signal<number>(0);
  miscellaneous_cost = signal<number>(0);

  readonly coordinates: LngLatLike = [this.lng, this.lat];
  readonly visits = computed(() =>
    this.tripService.plan()?.visitsArray().filter(v => v.place_id === this.id) ?? []
  );

  constructor(
    data: IPlace,
    private tripService: TripService
  ) {
    const { name, accommodation_cost, food_cost, miscellaneous_cost, ...statics } = data;
    Object.assign(this, statics);
    this.update(data);
  }

  get country(): Country | undefined {
    return this.tripService.trip()?.countries().get(this.country_id);
  }

  get season(): Season | undefined {
    return this.season_id ? this.tripService.trip()?.seasons().get(this.season_id) : undefined;
  }

  update(data: Partial<IPlace>) {
    if ('name' in data) this.name.set(data.name ?? '');
    if ('accommodation_cost' in data) this.accommodation_cost.set(data.accommodation_cost ?? 0);
    if ('food_cost' in data) this.food_cost.set(data.food_cost ?? 0);
    if ('miscellaneous_cost' in data) this.miscellaneous_cost.set(data.miscellaneous_cost ?? 0);
  }

  get totalDailyCost(): number {
    return this.accommodation_cost() + this.food_cost() + this.miscellaneous_cost();
  }

  getGoogleMapsLink(): string {
    return `https://www.google.com/maps?q=${this.lat},${this.lng}`;
  }

  toJSON(): IPlace {
    return {
      id: this.id,
      name: this.name(),
      lat: this.lat,
      lng: this.lng,
      country_id: this.country_id,
      season_id: this.season_id,
      trip_id: this.trip_id,
      accommodation_cost: this.accommodation_cost(),
      food_cost: this.food_cost(),
      miscellaneous_cost: this.miscellaneous_cost(),
    } as IPlace;
  }
}
