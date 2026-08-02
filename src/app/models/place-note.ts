import { TripService } from '../services/trip';
import {computed, signal} from '@angular/core';
import {Place} from './place';
import { ActivityStatus } from './activity';


export interface IPlaceNote {
  id: string;
  place_id: string;
  trip_id: string;
  description: string;
  category: string | null;
  estimated_cost?: number | null;
  status: ActivityStatus;
  actual_cost?: number | null;
  /** @deprecated legacy field, old site only — ignored by this frontend */
  included?: boolean;
  /** @deprecated legacy field, old site only — ignored by this frontend */
  paid?: boolean;
}


export type NewPlaceNote = Omit<IPlaceNote, 'id'>;
export type UpdatePlaceNote= Partial<Pick<IPlaceNote, 'description' | 'category' | 'estimated_cost' | 'actual_cost' | 'status'>>;


export class PlaceNote {
  id!: string;
  place_id!: string;
  trip_id!: string;
  description = signal<string>('');
  category = signal<string | null>(null);
  estimated_cost = signal<number | null>(null);
  status = signal<ActivityStatus>('planned');
  actual_cost = signal<number | null>(null);
  descriptionFetched = signal<boolean>(false);


  readonly expenses = computed(() =>
    Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => e.place_note_id === this.id)
  );

  readonly paidAmount = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount(), 0)
  );

  readonly isPaid = computed(() =>
    this.actual_cost() !== null && this.paidAmount() >= this.actual_cost()!
  );

  /** Inferred, never stored — matches our earlier decision. */
  readonly isDone = computed(() =>
    this.status() === 'planned' && this.actual_cost() !== null
  );

  /** actualCost != null ? actualCost : (status === 'planned' ? estimatedCost : 0) */
  readonly projectedCost = computed(() => {
    const actual = this.actual_cost();
    if (actual !== null) return actual;
    return this.status() === 'planned' ? (this.estimated_cost() ?? 0) : 0;
  });

  /** estimatedCost counts toward budget unless excluded — skipped still counts */
  readonly budgetCost = computed(() =>
    this.status() !== 'excluded' ? (this.estimated_cost() ?? 0) : 0
  );

  constructor(
    data: IPlaceNote,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.place_id = data.place_id.toString();
    this.trip_id = data.trip_id.toString();
    this.update(data);
    this.descriptionFetched.set('description' in data);
  }

  update(data: Partial<IPlaceNote>) {
    if ('description' in data) {
      this.description.set(data.description ?? '');
      this.descriptionFetched.set(true);
    }
    if ('category' in data) this.category.set(data.category ?? null);
    if ('estimated_cost' in data) this.estimated_cost.set(data.estimated_cost ?? null);
    if ('status' in data) this.status.set(data.status ?? 'planned');
    if ('actual_cost' in data) this.actual_cost.set(data.actual_cost ?? null);
  }

  get place(): Place | undefined {
    return this.tripService.trip()?.places().get(this.place_id);
  }

  toJSON(): IPlaceNote {
    return {
      id: this.id,
      place_id: this.place_id,
      trip_id: this.trip_id,
      description: this.description(),
      category: this.category(),
      estimated_cost: this.estimated_cost(),
      actual_cost: this.actual_cost(),
      status: this.status()
    } as IPlaceNote;
  }
}
