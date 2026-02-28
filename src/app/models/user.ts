import {ITrip} from './trip';

export interface TripsDataPackage {
  trips: ITrip[];
  plans: IUserPlan[];
}

export interface IUserTrip {
  id: string;
  name: string;
  plans: IUserPlan[];
}

export interface IUserPlan {
  id: string;
  name: string;
  priority: number;
  trip_id: string;
}
