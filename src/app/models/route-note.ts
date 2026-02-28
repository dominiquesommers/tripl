import { TripService } from '../services/trip';
import { signal } from '@angular/core';
import {Route} from './route';


export interface IRouteNote {
  id: string;
  route_id: string;
  trip_id: string;
  description: string;
}


export type NewRouteNote = Omit<IRouteNote, 'id'>;
export type UpdateRouteNote= Partial<Pick<IRouteNote, 'description'>>;


export class RouteNote {
  id!: string;
  route_id!: string;
  trip_id!: string;
  description = signal<string>('');
  descriptionFetched = signal<boolean>(false);

  constructor(
    data: IRouteNote,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.route_id = data.route_id.toString();
    this.trip_id = data.trip_id.toString();
    this.update(data);
    this.descriptionFetched.set('description' in data);
  }

  update(data: Partial<IRouteNote>) {
    if ('description' in data) {
      this.description.set(data.description ?? '');
      this.descriptionFetched.set(true);
    }
  }

  get route(): Route | undefined {
    return this.tripService.trip()?.routes().get(this.route_id);
  }

  toJSON(): IRouteNote {
    return {
      id: this.id,
      route_id: this.route_id,
      trip_id: this.trip_id
    } as IRouteNote;
  }
}
