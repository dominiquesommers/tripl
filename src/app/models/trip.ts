import { Place } from './place';
import { signal } from '@angular/core';

export interface ITrip {
  id: string;
  name: string;
}

export class Trip implements ITrip {
  id: string;
  name: string;
  readonly places = signal<Place[]>([]);

  constructor(data: ITrip, places: Place[]) {
    this.id = data.id;
    this.name = data.name;
    this.places.set(places);
  }

  addPlace(place: Place) {
    this.places.update(ps => [...ps, place]);
  }

  removePlace(id: string) {
    this.places.update(ps => ps.filter(p => p.id !== id));
  }
}
