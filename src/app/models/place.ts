import { Country, ICountry } from './country';
import { Season } from './season';
import { TripService } from '../services/trip';
import { signal, computed } from '@angular/core';
import {LngLatLike} from 'mapbox-gl';
import {CostBreakdown, CostComparison} from './cost';


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


export type NewPlace = Omit<IPlace, 'id' | 'season_id'>;
export type UpdatePlace = Partial<Pick<IPlace, 'name' | 'accommodation_cost' | 'food_cost' | 'miscellaneous_cost' | 'season_id'>>;


export class Place {
  id!: string;
  lat!: number;
  lng!: number;
  country_id!: string;
  season_id?: string | null;
  trip_id!: string;
  name = signal<string>('');
  readonly accommodation_cost = signal<number | null>(null);
  readonly food_cost = signal<number | null>(null);
  readonly miscellaneous_cost = signal<number | null>(null);

  readonly coordinates: LngLatLike = [this.lng, this.lat];
  readonly visits = computed(() =>
    this.tripService.plan()?.visitsArray().filter(v => v.place_id === this.id) ?? []
  );

  readonly activities = computed(() =>
    [...this.tripService.trip()?.activities().values() ?? []].filter(a => a.place_id === this.id) ?? []
  );

  readonly notes = computed(() =>
    [...this.tripService.trip()?.placeNotes().values() ?? []].filter(a => a.place_id === this.id) ?? []
  );

  readonly inItinerary = computed((): boolean => this.visits().some(v => v.inItinerary()));

  readonly oneTimeCost = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();
    const est = new CostBreakdown(
      0, 0, 0,
      this.activities().filter(a => a.included()).reduce((sum, a) => sum + (a.estimated_cost() ?? 0), 0),
      this.notes().filter(n => n.included()).reduce((sum, n) => sum + (n.estimated_cost() ?? 0), 0)
    );
    const act = est.clone();
    // TODO add actual costs.
    return new CostComparison(est, act);
  });

  readonly cost = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();
    let total = this.oneTimeCost();
    this.visits().forEach(v => {
      total = total.add(v.cost());
    });
    return total;
  });

  constructor(
    data: IPlace,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.country_id = data.country_id.toString();
    this.season_id = (data.season_id) ? data.season_id.toString() : null;
    this.trip_id = data.trip_id.toString();
    this.lng = data.lng;
    this.lat = data.lat;
    this.update(data);
  }

  get country(): Country {
    const country = this.tripService.trip()?.countries().get(this.country_id);
    if (!country) throw new Error(`Invariant Violation: Place ${this.id} references non-existent Country ${this.country_id}`);
    return country;
  }

  get season(): Season | undefined {
    return this.season_id ? this.tripService.trip()?.seasons().get(this.season_id) : undefined;
  }

  update(data: Partial<IPlace>) {
    if ('name' in data) this.name.set(data.name ?? '');
    if ('accommodation_cost' in data) this.accommodation_cost.set(data.accommodation_cost ?? null);
    if ('food_cost' in data) this.food_cost.set(data.food_cost ?? null);
    if ('miscellaneous_cost' in data) this.miscellaneous_cost.set(data.miscellaneous_cost ?? null);
  }

  // get totalDailyCost(): number {
  //   return this.accommodation_cost() + this.food_cost() + this.miscellaneous_cost();
  // }

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
