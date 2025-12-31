import {IPlace, Place} from './place';
import {signal} from '@angular/core';
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
