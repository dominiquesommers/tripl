import { Place } from './place';

export interface IVisit {
  id: string;
  place_id: string;
  plan_id: string;
  nights: number;
  included: boolean;
}

export class Visit implements IVisit {
  id: string;
  place_id: string;
  plan_id: string;
  nights: number;
  included: boolean;

  place?: Place;

  constructor(data: IVisit) {
    this.id = data.id;
    this.place_id = data.place_id;
    this.plan_id = data.plan_id;
    this.nights = data.nights ?? 0;
    this.included = data.included ?? true;
  }
}
