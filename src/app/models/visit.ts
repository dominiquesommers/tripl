import {IPlace, Place} from './place';
import {computed, signal, untracked} from '@angular/core';
import {TripService} from '../services/trip';
import {Traverse} from './traverse';

export interface IVisit {
  id: string;
  place_id: string;
  plan_id: string;
  nights: number;
  included: boolean;
}

export type NewVisit = Omit<IVisit, 'id'>;
export type UpdateVisit = Partial<Omit<IVisit, 'id' | 'place_id' | 'plan_id'>>;

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

  constructor(
    data: IVisit,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.place_id = data.place_id.toString();
    this.plan_id = data.plan_id.toString();
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
