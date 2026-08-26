import {computed, Signal, signal, WritableSignal} from '@angular/core';
import { Place } from './place';
import { Traverse } from './traverse';
import {TripService} from '../services/trip';
import {Country} from './country';
import { computeRouteSpline, distSq, LngLat } from '../utils/geo';
import {CostBreakdown, CostComparison} from './cost';
import {LngLatLike} from 'mapbox-gl';
import { LAND_MODES } from '../components/map-handler/config/map-styles.config';

export type RouteType = 'flying' | 'driving' | 'bus' | 'train' | 'boat' | 'walking' | 'twowheeler' | 'taxi' | 'other' | undefined;

export interface IRoute {
  id: string;
  source: string;
  target: string;
  type: RouteType;
  distance: number;
  duration: number;
  estimated_cost?: number | null;
  nights: number;
  route: string;
  actual_cost?: number | null;
  paid?: boolean;
  trip_id: string;
}


export type NewRoute = Omit<IRoute, 'id'>;
export type UpdateRoute = Partial<Pick<IRoute, 'type' | 'distance' | 'duration' | 'estimated_cost' | 'nights' | 'route' | 'actual_cost' | 'paid'>>;


export class Route {
  id!: string;
  sourceId!: string;
  targetId!: string;
  trip_id!: string;
  type = signal<RouteType>(undefined);
  distance = signal<number>(0);
  duration = signal<number>(0);
  estimated_cost = signal<number | null>(null);
  nights = signal<number>(0);
  route = signal<string>('');
  actual_cost = signal<number | null>(null);
  paid = signal<boolean>(false);

  readonly traverses = computed(() =>
    this.tripService.plan()?.traversesArray().filter(t => t.route_id === this.id) ?? []
  );

  readonly notes = computed(() =>
    [...this.tripService.trip()?.routeNotes().values() ?? []].filter(a => a.route_id === this.id) ?? []
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

  readonly path = computed((): LngLat[] => {
    const source = this.source;
    const target = this.target;
    if (!source || !target) return this.lineCoordinates() as LngLat[];

    let points: LngLat[];
    try {
      const parsed = JSON.parse(this.route());
      points = Array.isArray(parsed) && parsed.length >= 2 ? parsed : this.lineCoordinates();
    } catch {
      points = this.lineCoordinates() as LngLat[];
    }

    const first = points[0];
    const last = points[points.length - 1];
    const sourcePoint: [number, number] = [source.lng, source.lat];
    const targetPoint: [number, number] = [target.lng, target.lat];

    // Pragmatic fix: some rows were saved as [lat,lng] instead of [lng,lat].
    // Pick whichever orientation puts the endpoints closer to the known
    // source/target coords, and swap the whole path if it's the reversed one.
    const asIsError = distSq(first, sourcePoint) + distSq(last, targetPoint);
    const swappedError = distSq([first[1], first[0]], sourcePoint) + distSq([last[1], last[0]], targetPoint);

    return swappedError < asIsError ? points.map(([a, b]): [number, number] => [b, a]) : points;
  });

  readonly routeSpline = computed((): LngLat[][] => {
    const source = this.source;
    const target = this.target;
    if (!source || !target) return [[]];
    return [computeRouteSpline(this.path(),
      [source.lng, source.lat], [target.lng, target.lat], this.source?.name() ?? '', this.type() ?? ''
    )];
  });

  readonly traversedAs = computed(() => {
    const traverses = this.traverses();
    if (traverses.some(t => t.activeRentalSources().filter(rs => rs.route.type() === this.type()).length)) {
      return (traverses.some(t => t.inItinerary() && !t.activeRentalSources().length) ? 'both' : 'tour');
    };
    return this.inItinerary() ? 'segment' : null;
  });

  readonly inItinerary = computed((): boolean => this.traverses().some(t => t.inItinerary()));

  readonly cost = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();
    const estBase = CostBreakdown.empty();
    let total = new CostComparison(estBase, estBase.clone(), estBase.clone());
    this.traverses().forEach(t => {
      total = total.add(t.cost_());
    });
    return total;
  });

  readonly isCrossCountry = computed(() => {
    return this.source.country_id !== this.target.country_id;
  });

  readonly middlePoint: Signal<[number, number]> = computed(() => {
    return [(this.source.lng + this.target.lng) / 2, (this.source.lat + this.target.lat) / 2];
  });

  popupCoords: LngLatLike | null = null;

  constructor(
    data: IRoute,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.sourceId = data.source.toString();
    this.targetId = data.target.toString();
    this.trip_id = data.trip_id.toString();
    this.update(data);
  }

  get source(): Place {
    const place = this.tripService.trip()?.places().get(this.sourceId);
    if (!place) throw new Error(`Invariant Violation: Route ${this.id} references non-existent source Place ${this.sourceId}`);
    return place;
  }

  get target(): Place {
    const place = this.tripService.trip()?.places().get(this.targetId);
    if (!place) throw new Error(`Invariant Violation: Route ${this.id} references non-existent target Place ${this.targetId}`);
    return place;
  }

  update(data: Partial<IRoute>) {
    if ('type' in data) this.type.set(data.type);
    if ('distance' in data) this.distance.set(data.distance ?? 0);
    if ('duration' in data) this.duration.set(data.duration ?? 0);
    if ('estimated_cost' in data) this.estimated_cost.set(data.estimated_cost ?? null);
    if ('nights' in data) this.nights.set(data.nights ?? 0);
    if ('route' in data) this.route.set(data.route ?? '');
    if ('actual_cost' in data) this.actual_cost.set(data.actual_cost ?? null);
    if ('paid' in data) this.paid.set(data.paid ?? false);
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
