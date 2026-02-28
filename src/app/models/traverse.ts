import {computed, signal} from '@angular/core';
import { Visit } from './visit';
import { Route } from './route';
import { TripService } from '../services/trip';
import {CostBreakdown, CostComparison} from './cost';


export interface ITraverse {
  id?: string;
  source_visit_id: string;
  target_visit_id: string;
  route_id: string;
  priority: number;
  rent_until?: string | null
  includes_accommodation?: boolean;
  plan_id: string;
  cost?: number | null;
  booked_days?: number | null;
}


export type NewTraverse = Omit<ITraverse, 'id'>;
export type UpdateTraverse = Partial<Pick<ITraverse, 'priority' | 'rent_until' | 'includes_accommodation' | 'cost' | 'booked_days'>>;

export class Traverse {
  id: string;
  source_visit_id!: string;
  target_visit_id!: string;
  route_id!: string;
  plan_id!: string;
  priority = signal<number>(0);
  rent_until = signal<string | null>(null);
  includes_accommodation = signal<boolean>(false);
  cost = signal<number | null>(null);
  booked_days = signal<number | null>(null);

  readonly rentUntilVisit = computed((): Visit | null => {
    const rentUntil = this.rent_until();
    if (!rentUntil) return null;
    return this.tripService.plan()?.visits().get(rentUntil)!;
  });

  readonly activeRentalSource = computed<Traverse | null>((): Traverse | null => {
    const plan = this.tripService.plan();
    if (!plan) return null;
    const itinerary = plan.itinerary();
    let currentRental: Traverse | null = null;
    for (const visit of itinerary.slice(0, -1)) {
      const traverse = visit.nextTraverse()!;
      if (traverse.rent_until()) currentRental = traverse;
      if (traverse.id === this.id) return currentRental;
      if (currentRental?.rent_until() === traverse.target_visit_id) currentRental = null;
    }
    return null;
  });

  readonly inItinerary = computed((): boolean => {
    const plan = this.tripService.plan();
    if (!plan) return false;
    return plan.itinerary().some(v => v.nextTraverse()?.id === this.id);
  });

  // TODO refactor cost (attribute) to actual_cost such that this computed can be named 'cost'
  readonly cost_ = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();

    const rentalSource = this.activeRentalSource();
    const r = this.route;
    const nights = r.nights() || 0; // The nights spent ON this traverse
    const baseEst = r.estimated_cost() ?? 0;

    let est = CostBreakdown.empty();

    // TODO check if it is possible to have non-driving traverses while renting (then both the rentalSource and the current traverse should be counted.)
    // CASE 1: Within a Rental Period
    if (rentalSource) {
      // console.log(this.id, this.route.type(), 'within a rental period.', rentalSource)
      // We use the Daily Rate of the source, multiplied by the nights of THIS segment
      const dailyRate = rentalSource.route.estimated_cost() ?? 0;
      const coveredVisitNights = (rentalSource.id === this.id) ? 1 : (this.source.nights() || 0);
      const total = dailyRate * (coveredVisitNights + nights); // Since we are already renting before entering the source visit
      if (rentalSource.includes_accommodation()) {
        est.transport = total * 0.5;
        est.accommodation = total * 0.5;
      } else {
        est.transport = total;
      }
    }
    if (r.type() !== 'driving') {
      // CASE 2: Not a rental, but has overnight stays (Boat/Sleeper/Overnight flight)
      if (nights > 0) {
        if (r.type() === 'boat') {
          const q = baseEst * 0.25;
          // Split 25% each to Transport, Accommodation, Food, Activities
          est = new CostBreakdown(q, q, q, q, 0);
        } else {
          // "Sleeper Train/Overnight Flight" style: 40% Acc, 40% Trans, 20% Food
          est = new CostBreakdown(
            baseEst * 0.4,
            baseEst * 0.4,
            baseEst * 0.2,
            0, 0
          );
        }
      } else {
        est.transport = r.estimated_cost() ?? 0;
      }
    }

    // console.log(this.id, est.total);
    return new CostComparison(est, est.clone());
  });

  constructor(
    data: ITraverse,
    private tripService: TripService
  ) {
    this.id = data.id || `${data.source_visit_id}-${data.target_visit_id}-${data.route_id}`;
    this.source_visit_id = data.source_visit_id.toString();
    this.target_visit_id = data.target_visit_id.toString();
    this.route_id = data.route_id.toString();
    this.plan_id = data.plan_id.toString();
    this.update(data);
  }

  get source(): Visit {
    const visit = this.tripService.plan()?.visits().get(this.source_visit_id);
    if (!visit) throw new Error(`Invariant Violation: Traverse ${this.id} references non-existent source Visit ${this.source_visit_id}`);
    return visit;
  }

  get target(): Visit {
    const visit = this.tripService.plan()?.visits().get(this.target_visit_id);
    if (!visit) throw new Error(`Invariant Violation: Traverse ${this.id} references non-existent target Visit ${this.target_visit_id}`);
    return visit;
  }

  get route(): Route {
    const route = this.tripService.trip()?.routes().get(this.route_id);
    if (!route) throw new Error(`Invariant Violation: Traverse ${this.id} references non-existent Route ${this.route_id}`);
    return route;
  }

  update(data: Partial<ITraverse>) {
    if ('priority' in data) this.priority.set(data.priority ?? 0);
    if ('rent_until' in data) this.rent_until.set(data.rent_until?.toString() ?? null);
    if ('includes_accommodation' in data) this.includes_accommodation.set(data.includes_accommodation ?? false);
    if ('cost' in data) this.cost.set(data.cost ?? null);
    if ('booked_days' in data) this.booked_days.set(data.booked_days ?? null);
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
