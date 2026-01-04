import {computed, signal} from '@angular/core';
import { Place } from './place';
import { Traverse } from './traverse';
import {TripService} from '../services/trip';
import {Country} from './country';

export type RouteType = 'flying' | 'driving' | 'bus' | 'train' | 'boat' | undefined;

export interface IRoute {
  id: string;
  source: string;
  target: string;
  type: RouteType;
  distance: number;
  duration: number;
  estimated_cost: number;
  nights: number;
  route: string;
  actual_cost: number;
  paid: boolean;
  trip_id: string;
}


export type NewRoute = Omit<IRoute, 'id'>;
export type UpdateRoute = Partial<Omit<IRoute, 'id' | 'trip_id' | 'source' | 'target'>>;


export class Route {
  id!: string;
  sourceId!: string;
  targetId!: string;
  trip_id!: string;
  type = signal<RouteType>(undefined);
  distance = signal<number>(0);
  duration = signal<number>(0);
  estimated_cost = signal<number>(0);
  nights = signal<number>(0);
  route = signal<string>('');
  actual_cost = signal<number>(0);
  paid = signal<boolean>(false);

  readonly traverses = computed(() =>
    this.tripService.plan()?.traverses().filter(t => t.route_id === this.id) ?? []
  );
  readonly lineCoordinates = computed(() => {
    const source = this.source;
    const target = this.target;
    if (!source || !target) return [];
    return [
      [source.lng, source.lat],
      [target.lng, target.lat]
    ];
  });

  readonly routeSpline = computed(() => {
    const source = this.source;
    const target = this.target;
    if (!source || !target) return [];
    return this.computeRouteSpline([[source.lng, source.lat], [target.lng, target.lat]]);
  });

  constructor(
    data: IRoute,
    private tripService: TripService
  ) {
    this.id = data.id;
    this.sourceId = data.source;
    this.targetId = data.target;
    this.trip_id = data.trip_id;
    this.update(data);
  }

  get source(): Place | undefined {
    return this.tripService.trip()?.places().get(this.sourceId);
  }

  get target(): Place | undefined {
    return this.tripService.trip()?.places().get(this.targetId);
  }

  update(data: Partial<IRoute>) {
    if ('type' in data) this.type.set(data.type);
    if ('distance' in data) this.distance.set(data.distance ?? 0);
    if ('duration' in data) this.duration.set(data.duration ?? 0);
    if ('estimated_cost' in data) this.estimated_cost.set(data.estimated_cost ?? 0);
    if ('nights' in data) this.nights.set(data.nights ?? 0);
    if ('route' in data) this.route.set(data.route ?? '');
    if ('actual_cost' in data) this.actual_cost.set(data.actual_cost ?? 0);
    if ('paid' in data) this.paid.set(data.paid ?? false);
  }

  private computeRouteSpline(controlpoints: number[][]): number[][] {
    if (!this.source || !this.target) return [];
    return [];
    // const start_dist = Math.sqrt( Math.pow((controlpoints[0][0]-this.source.lat), 2) + Math.pow((controlpoints[0][1]-this.source.lng), 2) );
    // const end_dist = Math.sqrt( Math.pow((controlpoints[controlpoints.length - 1][0]-this.target.lat), 2) + Math.pow((controlpoints[controlpoints.length - 1][1]-this.target.lng), 2) );
    // // if (start_dist > 100 || end_dist > 100) {
    // //   console.log(this.source.name, this.destination.name);
    // // }
    // if (start_dist > 0.05 && start_dist < 100) {
    //   controlpoints = [[this.source?.lat, this.source?.lng], ...controlpoints];
    // }
    // if (end_dist > 0.05 && end_dist < 100) {
    //   controlpoints = [...controlpoints, [this.target.lat, this.target.lng]];
    // }
    // if (controlpoints.length > 2) {
    //   const omit_factor = {undefined: 1, 'boat': 1, 'flying': 1, 'bus': 7, 'train': 10, 'driving': 5}[this.type() as string] ?? 1;
    //   return [interpolateBSpline([controlpoints[0], ...controlpoints.slice(1, -1).filter((value, index, Arr) => index % omit_factor == 0), controlpoints[controlpoints.length - 1]], 5)];
    // } else {
    //   const diff = controlpoints[0][0] - controlpoints[1][0];
    //   if (Math.abs(diff) > 180) {
    //     const c1 = 180 - Math.abs(controlpoints[0][0]);
    //     const c2 = 180 - Math.abs(controlpoints[1][0]);
    //     const mid = (controlpoints[0][1] * (c2 / (c1 + c2))) + (controlpoints[1][1] * (c1 / (c1 + c2)));
    //     return [[controlpoints[0], [((diff > 180) ? 1 : -1) * 180, mid + ((diff > 180) ? 2 : -2)]], [[((diff > 180) ? -1 : 1) * 180, mid + ((diff > 180) ? 2 : -2)], controlpoints[1]]];
    //   }
    //   const bearing = {'Schiphol': -40, 'Buenos Aires': -20}[this.source.name()];
    //   const pointC1 = calculatePointC(controlpoints[0], controlpoints[controlpoints.length - 1], bearing ?? 10);
    //   return [interpolateBSpline([controlpoints[0], [pointC1[1], pointC1[0]], controlpoints[controlpoints.length - 1]], 50)];
    // }
  }

  toJSON(): IRoute {
    return {
      id: this.id,
      source: this.sourceId,
      target: this.targetId,
      type: this.type(),
      distance: this.distance(),
      duration: this.duration(),
      estimated_cost: this.estimated_cost(),
      nights: this.nights(),
      route: this.route(),
      actual_cost: this.actual_cost(),
      paid: this.paid()
    } as IRoute;
  }
}
