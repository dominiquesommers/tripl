import {IPlace, Place} from './place';
import {computed, signal, untracked} from '@angular/core';
import {TripService} from '../services/trip';
import {Traverse} from './traverse';
import {CostBreakdown, CostComparison} from './cost';

export interface IVisit {
  id: string;
  place_id: string;
  plan_id: string;
  nights: number;
  included: boolean;
}

export type NewVisit = Omit<IVisit, 'id'>;
export type UpdateVisit = Partial<Pick<IVisit, 'nights' | 'included'>>;

export class Visit {
  id: string;
  place_id: string;
  plan_id: string;
  nights = signal<number>(0);
  included = signal<boolean>(true);

  readonly toString = computed(() => {
    return `${this.place?.name()} (${this.nights()}) (${this.id})`;
  })

  readonly outgoingTraverses = computed(() =>
    this.tripService.plan()?.traversesArray()
      .filter(t => t.source_visit_id === this.id)
      .sort((a, b) => a.priority() - b.priority())
      ?? []
  );

  readonly nextTraverse = computed((): Traverse | null => {
    const plan = this.tripService.plan();
    if (!plan) return null;
    const itinerary = plan.itinerary();
    const currentIndex = itinerary.findIndex(v => v.id === this.id);
    if (currentIndex === -1 || currentIndex >= itinerary.length - 1) return null;
    return this.outgoingTraverses().find(t => t.source === this && t.target === itinerary[currentIndex + 1]) ?? null;
  });

  readonly nextVisit = computed((): Visit | null => this.nextTraverse()?.target ?? null);

  readonly ingoingTraverses = computed(() =>
    this.tripService.plan()?.traversesArray().filter(t => t.target_visit_id === this.id) ?? []
  );

  readonly previousTraverse = computed((): Traverse | null => {
    const plan = this.tripService.plan();
    if (!plan) return null;
    const itinerary = plan.itinerary();
    const currentIndex = itinerary.findIndex(v => v.id === this.id);
    if (currentIndex <= 0) return null;
    return itinerary[currentIndex - 1].nextTraverse();
  });

  readonly previousVisit = computed((): Visit | null => this.previousTraverse()?.source ?? null);

  readonly entryDate = computed(() => {
    const plan = this.tripService.plan();
    if (!plan) return null;
    const startDate = plan.start_date();
    if (!startDate) return null;
    const itinerary = plan.itinerary();
    let totalNights = 0;
    for (const v of itinerary) {
      if (v.id === this.id) {
        const entry = new Date(startDate);
        entry.setDate(entry.getDate() + totalNights);
        return entry;
      }
      totalNights += v.nights();
      const traverse = v.nextTraverse();
      totalNights += traverse?.route?.nights() ?? 0;
    }
    return null;
  });

  readonly entryDateString = computed(() => {
    const date = this.entryDate();
    return date ? date.toLocaleDateString('nl-NL') : '';
  });

  readonly inItinerary = computed((): boolean => {
    return !!this.entryDate();
  });

  readonly exitDate = computed(() => {
    const start = this.entryDate();
    if (!start) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + this.nights());
    return end;
  });

  readonly exitDateString = computed(() => {
    const date = this.exitDate();
    return date ? date.toLocaleDateString('nl-NL') : '';
  });

  readonly activeRentalSource = computed<Traverse | null>(() => {
    const plan = this.tripService.plan();
    if (!plan) return null;
    const itinerary = plan.itinerary();
    let currentRental: Traverse | null = null;
    for (const visit of itinerary) {
      if (currentRental?.rent_until() === visit.id) currentRental = null;
      if (visit.id === this.id) return currentRental;
      const traverse = visit.nextTraverse()!;
      if (traverse.rent_until()) currentRental = traverse;
    }
    return null;
  });

  readonly cost = computed<CostComparison>(() => {
    if (!this.inItinerary()) {
      return CostComparison.empty();
    }
    const n = this.nights() || 0;
    const p = this.place;
    const rental = this.activeRentalSource();
    // If there's an active rental that includes accommodation, we set the "base" accommodation cost to 0.
    const shouldChargeAcc = !(rental && rental.includes_accommodation());
    // console.log(this.place.name(), shouldChargeAcc);
    const est = new CostBreakdown(
      shouldChargeAcc ? n * (p.accommodation_cost() ?? 0) : 0,
      0, n * (p.food_cost() ?? 0), 0, n * (p.miscellaneous_cost() ?? 0));
    const act = est.clone();
    // TODO add actual costs.
    // console.log(this.place.name(), est.total);
    return new CostComparison(est, act);
  });

  constructor(
    data: IVisit,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.place_id = data.place_id.toString();
    this.plan_id = data.plan_id.toString();
    this.update(data);
  }

  get place(): Place {
    const place = this.tripService.trip()?.places().get(this.place_id);
    if (!place) throw new Error(`Invariant Violation: Visit ${this.id} references non-existent Place ${this.place_id}`);
    return place;
  }

  update(data: Partial<IVisit>) {
    if ('nights' in data) this.nights.set(data.nights ?? 0);
    if ('included' in data) this.included.set(data.included ?? true);
  }

  toJSON(): IVisit {
    return {
      id: this.id,
      place_id: this.place_id,
      plan_id: this.plan_id,
      nights: this.nights(),
      included: this.included()
    } as IVisit;
  }
}
