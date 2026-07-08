import {ITrip} from './trip';
import { computed, signal } from '@angular/core';


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
}

export class UserTrip {
  id: string;
  name = signal<string>('');
  role = signal<string>('viewer');
  priority = signal<number>(0);
  plans = signal<UserPlan[]>([]);

  constructor(data: IUserTrip) {
    this.id = data.id;
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