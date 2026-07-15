import { TripService } from '../services/trip';
import {ITrip} from './trip';
import { computed, signal } from '@angular/core';


export interface ITripMember {
  id: string;
  display_name: string;
  role: string;
  joined_at: string;
}

export class TripMember {
  id: string;
  display_name: string;
  role = signal<string>('viewer');
  joined_at: string;

  constructor(data: ITripMember, private tripService: TripService) {
    this.id = data.id;
    this.display_name = data.display_name;
    this.role.set(data.role);
    this.joined_at = data.joined_at;
  }

  update(data: Partial<ITripMember>) {
    if ('role' in data) this.role.set(data.role ?? 'viewer');
  }
}

export interface TripsDataPackage {
  trips: ITrip[];
  plans: IUserPlan[];
}

export interface IUserTrip {
  id: string;
  name: string;
  role: string;
  priority: number;
  plans: IUserPlan[];
  owner_name?: string;
}

export type UpdateUserTrip = Partial<Omit<IUserTrip, 'id' | 'owner_name'>>;

export class UserTrip {
  id: string;
  owner_name?: string;
  name = signal<string>('');
  role = signal<string>('viewer');
  priority = signal<number>(0);
  plans = signal<UserPlan[]>([]);

  constructor(data: IUserTrip) {
    this.id = data.id;
    this.owner_name = data.owner_name;
    this.name.set(data.name);
    this.role.set(data.role);
    this.priority.set(data.priority);
    this.plans.set(data.plans.map(p => new UserPlan(p)));
  }

  update(data: Partial<IUserTrip>) {
    if ('name' in data) this.name.set(data.name ?? '');
    if ('role' in data) this.role.set(data.role ?? 'viewer');
    if ('priority' in data) this.priority.set(data.priority ?? 0);
  }
}

export interface IUserPlan {
  id: string;
  name: string;
  priority: number;
  trip_id: string;
}

export class UserPlan {
  id: string;
  trip_id: string;
  name = signal<string>('');
  priority = signal<number>(0);

  constructor(data: IUserPlan) {
    this.id = data.id;
    this.trip_id = data.trip_id;
    this.name.set(data.name);
    this.priority.set(data.priority);
  }

  update(data: Partial<IUserPlan>) {
    if ('name' in data) this.name.set(data.name ?? '');
    if ('priority' in data) this.priority.set(data.priority ?? 0);
  }
}