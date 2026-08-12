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
  is_overnight?: boolean;
  rent_until?: string | null
  includes_accommodation?: boolean;
  plan_id: string;
  cost?: number | null;
  booked_days?: number | null;
}


export type NewTraverse = Omit<ITraverse, 'id'>;
export type UpdateTraverse = Partial<Pick<ITraverse, 'priority' | 'rent_until' | 'includes_accommodation' | 'cost' | 'booked_days' | 'is_overnight'>>;

// Define distribution types/weights (fractions adding up to 1.0)
interface CostDistribution {
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  miscellaneous: number;
}

const ROUTE_DISTRIBUTIONS: Record<string, CostDistribution> = {
  boat: { transport: 0.25, accommodation: 0.25, food: 0.25, activities: 0.25, miscellaneous: 0 },
  train: { transport: 0.4, accommodation: 0.4, food: 0.2, activities: 0, miscellaneous: 0 },
  bus: { transport: 0.4, accommodation: 0.4, food: 0.2, activities: 0, miscellaneous: 0 },
  flying: { transport: 0.4, accommodation: 0.4, food: 0.2, activities: 0, miscellaneous: 0 },
  default: { transport: 1.0, accommodation: 0, food: 0, activities: 0, miscellaneous: 0 }
};

export class Traverse {
  id: string;
  source_visit_id!: string;
  target_visit_id!: string;
  route_id!: string;
  plan_id!: string;
  priority = signal<number>(0);
  is_overnight = signal<boolean>(false);
  rent_until = signal<string | null>(null);
  includes_accommodation = signal<boolean>(false);
  cost = signal<number | null>(null);
  booked_days = signal<number | null>(null);
  readonly rentUntilVisit = computed((): Visit | null => {
    const rentUntil = this.rent_until();
    if (!rentUntil) return null;
    return this.tripService.plan()?.visits().get(rentUntil)!;
  });

  readonly activeRentalSources = computed<Traverse[]>(() => {
    const plan = this.tripService.plan();
    if (!plan) return [];
    const itinerary = plan.itinerary();
    let activeRentals: Traverse[] = [];

    for (const visit of itinerary) {
      const traverse = visit.nextTraverse();
      if (!traverse) continue;

      // 1. If this traverse starts a new rental, add it first
      if (traverse.rent_until()) {
        activeRentals = activeRentals.filter(r => r.route.type() !== traverse.route.type());
        activeRentals.push(traverse);
      }

      // 2. Check if this is our target traverse *before* we clean up ending rentals
      if (traverse.id === this.id) return activeRentals;

      // 3. Clean up rentals that have completed their journey at this traverse's target,
      // so they don't leak into *subsequent* legs past their end point.
      activeRentals = activeRentals.filter(rental => rental.rent_until() !== traverse.target_visit_id);
    }
    return [];
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
    if (!date) return '';
    return this.formatDate(date);
    // return date ? date.toLocaleDateString('nl-NL') : '';
  });

  readonly exitDate = computed((): Date | null => {
    if (!this.inItinerary()) return null;
    return this.target.entryDate();
  });

  readonly exitDateString = computed(() => {
    const date = this.exitDate();
    if (!date) return '';
    return this.formatDate(date);
    // return date ? date.toLocaleDateString('nl-NL') : '';
  });

  private formatDate(date: Date): string {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dd  = String(date.getDate()).padStart(2, '0');
    const mm  = String(date.getMonth() + 1).padStart(2, '0');
    const yy  = String(date.getFullYear()).slice(2);
    return `${day} ${dd}-${mm}-'${yy}`;
  }

  readonly cost_ = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();

    const activeRentals = this.activeRentalSources();
    const r = this.route;
    const nights = (this.is_overnight() ? 1 : 0);
    const baseEst = r.estimated_cost() ?? 0;
    const allBookings = this.allOverlappingBookings();
    const directBookings = allBookings.filter(b => b.route_id === this.route_id);
    if (directBookings.length > 0) {
      console.log('Multiple bookings found for a single tour/route-segment, not sure how to handle this yet.');
      // TODO think about blocking this in the UI altogether.
    }
    const actualPrice = (directBookings.length === 1) ? directBookings[0].final_price()! : 0;

    let est = CostBreakdown.empty();
    let act = CostBreakdown.empty();

    // ── 1. Accumulate costs from ALL active rentals ──
    for (const rentalSource of activeRentals) {
      const dailyRate = rentalSource.route.estimated_cost() ?? 0;
      const coveredVisitNights = (rentalSource.id === this.id) ? 1 : (this.source.nights() || 0);
      const total = dailyRate * (coveredVisitNights + nights);

      const rentalBookings = allBookings.filter(b => b.route_id === rentalSource.route_id);
      let actualTotal = 0;
      if (rentalBookings.length === 1) {
        const b = rentalBookings[0];
        if (b.departure_at() && b.arrival_at() && b.final_price() != null) {
          const numberOfDays = Math.max(0, Math.floor((new Date(b.arrival_at()!).getTime() - new Date(b.departure_at()!).getTime()) / (1000 * 60 * 60 * 24))) + 1;
          const actualDailyRate = b.final_price()! / numberOfDays;
          actualTotal = actualDailyRate * (coveredVisitNights + nights);
        }
      } else {
        console.log('Multiple bookings found for a single tour, not sure how to handle this yet.');
        // TODO think about blocking this in the UI altogether.
      }

      if (rentalSource.includes_accommodation()) {
        est.transport += total * 0.5;
        est.accommodation += total * 0.5;
        act.transport += actualTotal * 0.5;
        act.accommodation += actualTotal * 0.5;
      } else {
        est.transport += total;
        act.transport += actualTotal;
      }
    }

    // ── 2. Add current traverse route costs ONLY if not already covered by a matching tour/rental ──
    const hasMatchingRental = activeRentals.some(rental => rental.route.type() === r.type());
    if (!hasMatchingRental) {
      const distKey = (nights > 0) ? r.type() : 'default';
      const dist = ROUTE_DISTRIBUTIONS[distKey ?? 'default'] ?? ROUTE_DISTRIBUTIONS['default'];

      est.transport += baseEst * dist.transport;
      est.accommodation += baseEst * dist.accommodation;
      est.food += baseEst * dist.food;
      est.activities += baseEst * dist.activities;
      est.miscellaneous += baseEst * dist.miscellaneous;

      act.transport += actualPrice * dist.transport;
      act.accommodation += actualPrice * dist.accommodation;
      act.food += actualPrice * dist.food;
      act.activities += actualPrice * dist.activities;
      act.miscellaneous += actualPrice * dist.miscellaneous;
    }

    return new CostComparison(est, act, (directBookings.length === 1 || activeRentals.length > 0) ? act : est);
  });

  // Bookings specifically relevant to this leg's active route type (for status, unbooked badges, paid/pending checks)
  readonly overlappingBookings = computed(() => {
    const entry = this.entryDate();
    const exit = this.exitDate();
    if (!entry || !exit) return [];

    const activeRentals = this.activeRentalSources();
    const matchingRental = activeRentals.find(r => r.route.type() === this.route.type());
    const targetRouteId = (matchingRental ?? this).route_id;

    return Array.from(this.tripService.trip()?.routeBookings().values() ?? [])
        .filter(b => {
          if (b.route_id !== targetRouteId || !b.departure_at() || !b.arrival_at()) return false;
          const dep_date = new Date(b.departure_at()!.split(' ')[0] + 'T00:00:00Z');
          const arr_date = new Date(b.arrival_at()!.split(' ')[0] + 'T00:00:00Z');
          return dep_date <= exit && arr_date >= entry;
        });
  });

  // Bookings across ALL active rentals + this traverse's route (for comprehensive cost calculation)
  readonly allOverlappingBookings = computed(() => {
    const entry = this.entryDate();
    const exit = this.exitDate();
    if (!entry || !exit) return [];

    const activeRentals = this.activeRentalSources();
    // Gather all route IDs we need to account for (this traverse's route + all active rental routes)
    const relevantRouteIds = new Set([
      this.route_id,
      ...activeRentals.map(r => r.route_id)
    ]);

    return Array.from(this.tripService.trip()?.routeBookings().values() ?? [])
        .filter(b => {
          if (!relevantRouteIds.has(b.route_id) || !b.departure_at() || !b.arrival_at()) return false;
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
    if ('is_overnight' in data) this.is_overnight.set(data.is_overnight ?? false);
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
      is_overnight: this.is_overnight(),
      rent_until: this.rent_until(),
      includes_accommodation: this.includes_accommodation(),
      cost: this.cost(),
      booked_days: this.booked_days()
    } as ITraverse;
  }
}
