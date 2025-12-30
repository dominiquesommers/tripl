import { Country } from './country';
import { Season } from './season';
import {TripService} from '../services/trip';
import {computed} from '@angular/core';


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


export class Place implements IPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country_id: string;
  season_id: string;
  trip_id: string;
  accommodation_cost: number = 0;
  food_cost: number = 0;
  miscellaneous_cost: number = 0;

  country?: Country;
  season?: Season;

  readonly visits = computed(() =>
    this.tripService.plan()?.visits().filter(v => v.place_id === this.id) ?? []
  );

  constructor(
    data: IPlace,
    private tripService: TripService
  ) {
    this.id = data.id;
    this.name = data.name;
    this.lat = data.lat;
    this.lng = data.lng;
    this.country_id = data.country_id;
    this.season_id = data.season_id;
    this.trip_id = data.trip_id;
    this.accommodation_cost = data.accommodation_cost ?? 0;
    this.food_cost = data.food_cost ?? 0;
    this.miscellaneous_cost = data.miscellaneous_cost ?? 0;
  }

  get totalDailyCost(): number {
    return this.accommodation_cost + this.food_cost + this.miscellaneous_cost;
  }

  getGoogleMapsLink(): string {
    return `https://www.google.com/maps?q=${this.lat},${this.lng}`;
  }
}
