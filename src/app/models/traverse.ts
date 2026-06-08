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

  readonly entryDate = computed((): Date | null => {
    if (!this.inItinerary()) return null;
    return this.source.exitDate();
  });

  readonly entryDateString = computed(() => {
    const date = this.entryDate();
    return date ? date.toLocaleDateString('nl-NL') : '';
  });

  readonly exitDate = computed((): Date | null => {
    if (!this.inItinerary()) return null;
    return this.target.entryDate();
  });

  readonly exitDateString = computed(() => {
    const date = this.exitDate();
    return date ? date.toLocaleDateString('nl-NL') : '';
  });

  // TODO refactor cost (attribute) to actual_cost such that this computed can be named 'cost'
  readonly cost_ = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();

    const rentalSource = this.activeRentalSource();
    const r = this.route;
    const nights = r.nights() || 0; // The nights spent ON this traverse
    const baseEst = r.estimated_cost() ?? 0;
    const bookings = this.overlappingBookings();
    if (this.route.target.name() === 'Sydney') {
      console.log(bookings);
    }
    const actualPrice = (bookings.length === 1) ? bookings[0].final_price()! : 0;
    if (bookings.length > 1) {
      console.warn(`${this.id} ${this.route.source.name()} (${this.entryDate()}) -> ${this.route.source.name()} (${this.exitDate()}) double route booking, check.`);
    }

    let est = CostBreakdown.empty();
    let act = CostBreakdown.empty();

    // TODO check if it is possible to have non-driving traverses while renting (then both the rentalSource and the current traverse should be counted.)
    // CASE 1: Within a Rental Period
    if (rentalSource) {
      // console.log(this.id, this.route.type(), 'within a rental period.', rentalSource)
      // We use the Daily Rate of the source, multiplied by the nights of THIS segment
      const dailyRate = rentalSource.route.estimated_cost() ?? 0;
      const coveredVisitNights = (rentalSource.id === this.id) ? 1 : (this.source.nights() || 0);
      const total = dailyRate * (coveredVisitNights + nights); // Since we are already renting before entering the source visit
      let actualTotal = 0;
      // if (this.route.type() === 'driving' && this.route.source.country.name === 'Australia') {
      //   console.log(bookings);
      // }
      if (bookings.length === 1) {
        // TODO remove time info from strings.
        const numberOfDays = Math.max(0, Math.floor((new Date(bookings[0].arrival_at()!).getTime() - new Date(bookings[0].departure_at()!).getTime()) / (1000 * 60 * 60 * 24))) + 1;
        const actualDailyRate = actualPrice! / numberOfDays;
        actualTotal = actualDailyRate * (coveredVisitNights + nights);
        // if (this.route.type() === 'driving' && this.route.source.country.name === 'Australia') {
        //   console.log(actualDailyRate, actualTotal);
        // }
      }

      if (rentalSource.includes_accommodation()) {
        est.transport = total * 0.5;
        est.accommodation = total * 0.5;
        act.transport = actualTotal * 0.5;
        act.accommodation = actualTotal * 0.5;
      } else {
        est.transport = total;
        act.transport = actualTotal;
      }
    } else if (r.type() === 'driving') {
      console.warn(`${this.id} ${this.route.source.name()} (${this.entryDate()}) -> ${this.route.source.name()} (${this.exitDate()}) does not have an active rental source.`);
    }

    if (r.type() !== 'driving') {
      // CASE 2: Not a rental, but has overnight stays (Boat/Sleeper/Overnight flight)
      if (nights > 0) {
        if (r.type() === 'boat') {
          const q = baseEst * 0.25;
          const actQ = actualPrice * 0.25;
          // Split 25% each to Transport, Accommodation, Food, Activities
          est = new CostBreakdown(q, q, q, q, 0);
          act = new CostBreakdown(actQ, actQ, actQ, actQ, 0);
        } else {
          // "Sleeper Train/Overnight Flight" style: 40% Acc, 40% Trans, 20% Food
          est = new CostBreakdown(
            baseEst * 0.4,
            baseEst * 0.4,
            baseEst * 0.2,
            0, 0
          );
          act = new CostBreakdown(
            actualPrice * 0.4,
            actualPrice * 0.4,
            actualPrice * 0.2,
            0, 0
          );
        }
      } else {
        est.transport += r.estimated_cost() ?? 0;
        if (actualPrice < 1500) {
          act.transport += actualPrice ?? 0;
        }
        // act.transport += actualPrice ?? 0; // TODO check this for multiple overlapping bookings, like boat traverse during rental period.
      }
    }

    return new CostComparison(est, act, (bookings.length === 1) ? act : est);
  });

  readonly overlappingBookings = computed(() => {
    const entry = this.entryDate();
    const exit  = this.exitDate();
    if (!entry || !exit) return [];
    const rentalSource = this.activeRentalSource();
    return Array.from(this.tripService.trip()?.routeBookings().values() ?? [])
        .filter(b => {
          if (b.route_id !== (rentalSource ?? this).route_id || !b.departure_at() || !b.arrival_at() || !b.final_price()) return false;
          const dep_date = new Date(b.departure_at()!.split(' ')[0] + 'T00:00:00Z');
          const arr_date = new Date(b.arrival_at()!.split(' ')[0] + 'T00:00:00Z');
          return dep_date <= exit && arr_date >= entry;
        });
  });

  readonly hasBookings = computed(() => this.overlappingBookings().length > 0);

  readonly allBookingsPaid = computed(() => {
    const bookings = this.overlappingBookings();
    return bookings.length > 0 && bookings.every(b => b.isPaid());
  });

  readonly bookingStatus = computed(() => {
    if (this.cost_().estimated.total === 0) return 'paid';
    if (!this.inItinerary()) return 'not-in-itinerary';
    if (!this.hasBookings()) return 'unbooked';
    return this.allBookingsPaid() ? 'paid' : 'pending';
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
