import { TripService } from '../services/trip';
import {computed, signal} from '@angular/core';
import {Place} from './place';


export interface IActivity {
  id: string;
  place_id: string;
  trip_id: string;
  description: string;
  category: string | null;
  estimated_cost?: number | null;
  included: boolean;
  actual_cost?: number | null;
  paid?: boolean;
}


export type NewActivity = Omit<IActivity, 'id'>;
export type UpdateActivity = Partial<Pick<IActivity, 'description' | 'category' | 'estimated_cost' | 'actual_cost' | 'paid' | 'included'>>;


export class Activity {
  id!: string;
  place_id!: string;
  trip_id!: string;
  description = signal<string>('');
  category = signal<string | null>(null);
  estimated_cost = signal<number | null>(null);
  included = signal<boolean>(false);
  actual_cost = signal<number | null>(null);    // commitment_cost post-migration
  paid = signal<boolean>(false);                    // drop post-migration
  descriptionFetched = signal<boolean>(false);

  readonly expenses = computed(() =>
    Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => e.activity_id === this.id)
  );

  readonly paidAmount = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount(), 0)
  );

  readonly isPaid = computed(() =>
    this.actual_cost() !== null && this.paidAmount() >= this.actual_cost()!
  );

  constructor(
    data: IActivity,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.place_id = data.place_id.toString();
    this.trip_id = data.trip_id.toString();
    this.update(data);
    this.descriptionFetched.set('description' in data);
  }

  update(data: Partial<IActivity>) {
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

  get place(): Place | undefined {
    return this.tripService.trip()?.places().get(this.place_id);
  }

  toJSON(): IActivity {
    return {
      id: this.id,
      place_id: this.place_id,
      trip_id: this.trip_id,
      description: this.description(),
      category: this.category(),
      estimated_cost: this.estimated_cost(),
      included: this.included(),
      actual_cost: this.actual_cost(),
      paid: this.paid()
    } as IActivity;
  }
}
