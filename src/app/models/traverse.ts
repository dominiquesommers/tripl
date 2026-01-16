import {computed, signal} from '@angular/core';
import { Visit } from './visit';
import { Route } from './route';
import { TripService } from '../services/trip';


export interface ITraverse {
  source_visit_id: string;
  target_visit_id: string;
  route_id: string;
  priority: number;
  rent_until?: string | null
  includes_accommodation?: boolean | false;
  plan_id: string;
  cost?: number | 0;
  booked_days?: number | 0;
}


export type NewTraverse = ITraverse;
export type UpdateTraverse = Partial<Omit<ITraverse, 'source_visit_id' | 'target_visit_id' | 'route_id' | 'plan_id'>>;


export class Traverse {
  source_visit_id!: string;
  target_visit_id!: string;
  route_id!: string;
  plan_id!: string;
  priority = signal<number>(0);
  rent_until = signal<string | null>(null);
  includes_accommodation = signal<boolean>(false);
  cost = signal<number>(0);
  booked_days = signal<number>(0);

  readonly rentUntilVisit = computed(() => {
    const rentUntil = this.rent_until();
    if (!rentUntil) return null;
    return this.tripService.plan()?.visits().get(rentUntil);
  });

  constructor(
    data: ITraverse,
    private tripService: TripService
  ) {
    this.source_visit_id = data.source_visit_id.toString();
    this.target_visit_id = data.target_visit_id.toString();
    this.route_id = data.route_id.toString();
    this.plan_id = data.plan_id.toString();
    this.update(data);
  }

  get source(): Visit | undefined {
    return this.tripService.plan()?.visits().get(this.source_visit_id);
  }

  get target(): Visit | undefined {
    return this.tripService.plan()?.visits().get(this.target_visit_id);
  }

  get route(): Route | undefined {
    return this.tripService.trip()?.routes().get(this.route_id);
  }

  update(data: Partial<ITraverse>) {
    if ('priority' in data) this.priority.set(data.priority ?? 0);
    if ('rent_until' in data) this.rent_until.set(data.rent_until ?? '');
    if ('includes_accommodation' in data) this.includes_accommodation.set(data.includes_accommodation ?? false);
    if ('cost' in data) this.cost.set(data.cost ?? 0);
    if ('booked_days' in data) this.booked_days.set(data.booked_days ?? 0);
  }

  toJSON(): ITraverse {
    return {
      source_visit_id: this.source_visit_id,
      target_visit_id: this.target_visit_id,
      route_id: this.route_id,
      plan_id: this.plan_id,
      priority: this.priority(),
      rent_until: this.rent_until(),
      includes_accommodation: this.includes_accommodation(),
      cost: this.cost(),
      booked_days: this.booked_days()
    } as ITraverse;
  }
}
