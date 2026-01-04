import {IPlace, Place} from './place';
import {computed, signal} from '@angular/core';
import {TripService} from '../services/trip';

export interface IVisit {
  id: string;
  place_id: string;
  plan_id: string;
  nights: number;
  included: boolean;
}

export type NewVist = Omit<IVisit, 'id'>;
export type UpdateVisit = Partial<Omit<IVisit, 'id' | 'place_id' | 'plan_id'>>;

export class Visit {
  id: string;
  place_id: string;
  plan_id: string;
  nights = signal<number>(0);
  included = signal<boolean>(true);

  readonly outgoingTraverses = computed(() =>
    this.tripService.plan()?.traversesArray().filter(t => t.source_visit_id === this.id) ?? []
  );

  readonly nextTraverse = computed(() => {
    const outgoing = this.outgoingTraverses().filter(t => t.target?.included);
    if (outgoing.length === 0) return null;
    return outgoing.reduce((prev, curr) => curr.priority < prev.priority ? curr : prev);
  });

  readonly nextVisit = computed((): (Visit | null) => {
    const targetId = this.nextTraverse()?.target_visit_id;
    return targetId ? (this.tripService.plan()?.visits().get(targetId) ?? null) : null;
  });

  readonly ingoingTraverses = computed(() =>
    this.tripService.plan()?.traversesArray().filter(t => t.target_visit_id === this.id) ?? []
  );

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

  readonly exitDate = computed(() => {
    const start = this.entryDate();
    if (!start) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + this.nights());
    return end;
  });

  constructor(
    data: IVisit,
    private tripService: TripService
  ) {
    this.id = data.id;
    this.place_id = data.place_id;
    this.plan_id = data.plan_id;
    this.update(data);
  }

  get place(): Place | undefined {
    return this.tripService.trip()?.places().get(this.place_id);
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
