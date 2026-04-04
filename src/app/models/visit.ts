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
    if (!date) return '';
    return this.formatDate(date);
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
    if (!date) return '';
    return this.formatDate(date);
  });

  readonly totalDays = computed(() => {
    const start = this.entryDate();
    const end = this.exitDate();
    if (!start || !end) return 0;
    return this.daysBetween(start, end);
  });

  readonly monthDays = computed(() => {
    const start = this.entryDate();
    const end = this.exitDate();
    const results: Record<string, number> = {
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
    };
    if (!start || !end) return results;
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let current = new Date(start);
    const stopDate = new Date(end);
    while (current < stopDate) {
      const monthIndex = current.getMonth();
      results[monthKeys[monthIndex]]++;
      current.setDate(current.getDate() + 1);
    }
    return results;
  });

  readonly calculateSeasonScore = computed(() => {
    const season = this.place.season;
    const daysMap = this.monthDays();
    if (!season) return 0;
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return monthKeys.reduce((total, m) => {
      const days = daysMap[m];
      const score = (season as any)[m]();
      return total + (days * score);
    }, 0);
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
    if (!this.inItinerary()) return CostComparison.empty();

    const n = this.nights() || 0;
    const p = this.place;
    const rental = this.activeRentalSource();
    const entry  = this.entryDate();
    const exit   = this.exitDate();
    // If there's an active rental that includes accommodation, we set the "base" accommodation cost to 0.
    const shouldChargeAcc = !(rental && rental.includes_accommodation());
    // console.log(this.place.name(), shouldChargeAcc);
    const est = new CostBreakdown(
      shouldChargeAcc ? n * (p.accommodation_cost() ?? 0) : 0,
      0, n * (p.food_cost() ?? 0), 0, n * (p.miscellaneous_cost() ?? 0));

    if (!entry || !exit) return new CostComparison(est, est.clone());
    if (!this.tripService.trip()) return new CostComparison(est, est.clone());

    // ── Accommodation ─────────────────────────────────────────────────────
    let actualAccommodation: number;
    if (!shouldChargeAcc) {
      actualAccommodation = 0;
    } else if (!this.overlappingBookings().length) {
      actualAccommodation = est.accommodation;
    } else {
      actualAccommodation = this.overlappingBookings().reduce((sum, b) => {
        const bIn  = new Date(b.check_in()!  + 'T00:00:00');
        const bOut = new Date(b.check_out()! + 'T00:00:00');
        const overlapNights = this.daysBetween(this.clampDate(bIn, entry, exit), this.clampDate(bOut, entry, exit));
        const bookingNights = this.daysBetween(bIn, bOut);
        if (!bookingNights) return sum;
        const nightlyRate = (b.final_price()! * (1 - b.food_pct() / 100)) / bookingNights;
        return sum + overlapNights * nightlyRate;
      }, 0);
    }

    // ── Food ──────────────────────────────────────────────────────────────
    const foodFromExpenses = this.foodExpenses().reduce((sum, e) => sum + e.amount(), 0);
    const foodFromBookings = this.overlappingBookings()
      .filter(b => b.food_pct() > 0)
      .reduce((sum, b) => {
        const bIn  = new Date(b.check_in()!  + 'T00:00:00');
        const bOut = new Date(b.check_out()! + 'T00:00:00');
        const overlapNights = this.daysBetween(this.clampDate(bIn, entry, exit), this.clampDate(bOut, entry, exit));
        const bookingNights = this.daysBetween(bIn, bOut);
        if (!bookingNights) return sum;
        return sum + overlapNights * (b.final_price()! * (b.food_pct() / 100)) / bookingNights;
      }, 0);
    const elapsed   = this.nightsElapsed();
    const remaining = n - elapsed;
    const dailyFoodEst = p.food_cost() ?? 0;
    const actualFood = foodFromExpenses + foodFromBookings + remaining * dailyFoodEst;
    const actualMisc = this.miscExpenses()
      .reduce((sum, e) => sum + e.amount(), 0)
      + remaining * (p.miscellaneous_cost() ?? 0);

    const act = new CostBreakdown(actualAccommodation, 0, actualFood, 0, actualMisc);
    return new CostComparison(est, act);
  });

  readonly foodExpenses = computed(() => {
    const entry = this.entryDate();
    const exit  = this.exitDate();
    if (!entry || !exit) return [];
    return Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => {
        if (e.place_id !== this.place_id || e.category() !== 'food') return false;
        const d = new Date(e.date() + 'T00:00:00');
        return d >= entry && d < exit;
      });
  });

  readonly miscExpenses = computed(() => {
    const entry = this.entryDate();
    const exit  = this.exitDate();
    if (!entry || !exit) return [];
    return Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => {
        if (e.place_id !== this.place_id || e.category() !== 'miscellaneous') return false;
        const d = new Date(e.date() + 'T00:00:00');
        return d >= entry && d < exit;
      });
  });

  readonly overlappingBookings = computed(() => {
    const entry = this.entryDate();
    const exit  = this.exitDate();
    if (!entry || !exit) return [];
    return Array.from(this.tripService.trip()?.placeBookings().values() ?? [])
      .filter(b => {
        if (b.place_id !== this.place_id || !b.check_in() || !b.check_out() || !b.final_price()) return false;
        const bIn  = new Date(b.check_in()!  + 'T00:00:00');
        const bOut = new Date(b.check_out()! + 'T00:00:00');
        return bIn < exit && bOut > entry;
      });
  });

  readonly nightsElapsed = computed(() => {
    const entry = this.entryDate();
    const exit  = this.exitDate();
    if (!entry || !exit) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today <= entry) return 0;               // visit hasn't started
    if (today >= exit)  return this.nights();   // visit fully passed
    return this.daysBetween(entry, today);      // partially elapsed
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

  private daysBetween(start: Date, end: Date): number {
    return Math.max(0, Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    ));
  }

  private clampDate(date: Date, min: Date, max: Date): Date {
    if (date < min) return min;
    if (date > max) return max;
    return date;
  }

  private expenseDateToDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
  }

  private formatDate(date: Date): string {
    const day = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dd  = String(date.getDate()).padStart(2, '0');
    const mm  = String(date.getMonth() + 1).padStart(2, '0');
    const yy  = String(date.getFullYear()).slice(2);
    return `${day} ${dd}-${mm}-'${yy}`;
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
