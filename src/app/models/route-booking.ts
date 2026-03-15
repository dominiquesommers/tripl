import {computed, signal} from '@angular/core';
import {TripService} from '../services/trip';

export interface IRouteBooking {
  id: string;
  route_id: string;
  trip_id: string;
  departure_at: string | null;
  arrival_at: string | null;
  final_price: number | null;
  includes_accommodation: boolean;
  accommodation_pct: number;
  includes_food: boolean;
  food_pct: number;
  includes_activity: boolean;
  activity_pct: number;
  cancel_before: string | null;
  pay_by: string | null;
  details?: string | null;
  is_tentative: boolean;
}

export type NewRouteBooking = Omit<IRouteBooking, 'id'>;
export type UpdateRouteBooking = Partial<Pick<IRouteBooking,
  'departure_at' | 'arrival_at' | 'final_price' |
  'includes_accommodation' | 'accommodation_pct' |
  'includes_food' | 'food_pct' |
  'includes_activity' | 'activity_pct' |
  'cancel_before' | 'pay_by' | 'details' | 'is_tentative'
>>;

export class RouteBooking {
  id!: string;
  route_id!: string;
  trip_id!: string;
  departure_at           = signal<string | null>(null);
  arrival_at             = signal<string | null>(null);
  final_price            = signal<number | null>(null);
  includes_accommodation = signal<boolean>(false);
  accommodation_pct      = signal<number>(0);
  includes_food          = signal<boolean>(false);
  food_pct               = signal<number>(0);
  includes_activity      = signal<boolean>(false);
  activity_pct           = signal<number>(0);
  cancel_before          = signal<string | null>(null);
  pay_by                 = signal<string | null>(null);
  details                = signal<string | null>(null);
  is_tentative           = signal<boolean>(false);
  detailsFetched         = signal<boolean>(false);

  readonly expenses = computed(() =>
    Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => e.route_booking_id === this.id)
  );

  readonly paidAmount = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount(), 0)
  );

  readonly isPaid = computed(() =>
    this.final_price() !== null && this.paidAmount() >= this.final_price()!
  );

  constructor(
    data: IRouteBooking,
    private tripService: TripService
  ) {
    this.id       = data.id;
    this.route_id = data.route_id;
    this.trip_id  = data.trip_id;
    this.update(data);
    this.detailsFetched.set('details' in data && data.details !== undefined);
  }

  update(data: Partial<IRouteBooking>) {
    if ('departure_at'           in data) this.departure_at.set(data.departure_at ?? null);
    if ('arrival_at'             in data) this.arrival_at.set(data.arrival_at ?? null);
    if ('final_price'            in data) this.final_price.set(data.final_price ?? null);
    if ('includes_accommodation' in data) this.includes_accommodation.set(data.includes_accommodation ?? false);
    if ('accommodation_pct'      in data) this.accommodation_pct.set(data.accommodation_pct ?? 0);
    if ('includes_food'          in data) this.includes_food.set(data.includes_food ?? false);
    if ('food_pct'               in data) this.food_pct.set(data.food_pct ?? 0);
    if ('includes_activity'      in data) this.includes_activity.set(data.includes_activity ?? false);
    if ('activity_pct'           in data) this.activity_pct.set(data.activity_pct ?? 0);
    if ('cancel_before'          in data) this.cancel_before.set(data.cancel_before ?? null);
    if ('pay_by'                 in data) this.pay_by.set(data.pay_by ?? null);
    if ('details'                in data) { this.details.set(data.details ?? null); this.detailsFetched.set(true); }
    if ('is_tentative'           in data) this.is_tentative.set(data.is_tentative ?? false);
  }

  toJSON(): IRouteBooking {
    return {
      id:                     this.id,
      route_id:               this.route_id,
      trip_id:                this.trip_id,
      departure_at:           this.departure_at(),
      arrival_at:             this.arrival_at(),
      final_price:            this.final_price(),
      includes_accommodation: this.includes_accommodation(),
      accommodation_pct:      this.accommodation_pct(),
      includes_food:          this.includes_food(),
      food_pct:               this.food_pct(),
      includes_activity:      this.includes_activity(),
      activity_pct:           this.activity_pct(),
      cancel_before:          this.cancel_before(),
      pay_by:                 this.pay_by(),
      details:                this.details(),
      is_tentative:           this.is_tentative(),
    };
  }
}
