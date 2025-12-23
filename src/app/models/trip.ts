import { Place } from './place';

export interface ITrip {
  id: string;
  name: string;
}

export class Trip implements ITrip {
  id: string;
  name: string;
  places: Place[] = [];

  constructor(data: ITrip) {
    this.id = data.id;
    this.name = data.name;
  }
}
