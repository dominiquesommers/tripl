import { TripService } from '../services/trip';
import { signal } from '@angular/core';
import {Country} from './country';


export interface ICountryNote {
  id: string;
  country_id: string;
  trip_id: string;
  description: string;
  category: string | null;
  estimated_cost?: number | null;
  included: boolean;
  actual_cost?: number | null;
  paid?: boolean;
}


export type NewCountryNote = Omit<ICountryNote, 'id'>;
export type UpdateCountryNote= Partial<Pick<ICountryNote, 'description' | 'category' | 'estimated_cost' | 'actual_cost' | 'paid' | 'included'>>;


export class CountryNote {
  id!: string;
  country_id!: string;
  trip_id!: string;
  description = signal<string>('');
  category = signal<string | null>(null);
  estimated_cost = signal<number | null>(null);
  included = signal<boolean>(false);
  actual_cost = signal<number | null>(null);
  paid = signal<boolean>(false);
  descriptionFetched = signal<boolean>(false);

  constructor(
    data: ICountryNote,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.country_id = data.country_id.toString();
    this.trip_id = data.trip_id.toString();
    this.update(data);
    this.descriptionFetched.set('description' in data);
  }

  update(data: Partial<ICountryNote>) {
    if ('description' in data) {
      this.description.set(data.description ?? '');
      this.descriptionFetched.set(true);
    }
    if ('category' in data) this.category.set(data.category ?? null);
    if ('estimated_cost' in data) this.estimated_cost.set(data.estimated_cost ?? null);
    if ('included' in data) this.included.set(data.included ?? false);
    if ('actual_cost' in data) this.actual_cost.set(data.actual_cost ?? null);
    if ('paid' in data) this.paid.set(data.paid ?? false);
  }

  get country(): Country | undefined {
    return this.tripService.trip()?.countries().get(this.country_id);
  }

  toJSON(): ICountryNote {
    return {
      id: this.id,
      country_id: this.country_id,
      trip_id: this.trip_id,
      description: this.description(),
      category: this.category(),
      estimated_cost: this.estimated_cost(),
      included: this.included(),
      actual_cost: this.actual_cost(),
      paid: this.paid()
    } as ICountryNote;
  }
}
