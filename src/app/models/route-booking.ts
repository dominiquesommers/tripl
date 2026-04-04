import {computed, signal} from '@angular/core';
import {TripService} from '../services/trip';

export interface IRouteBooking {
  id: string;
  route_id: string;
  trip_id: string;
  departure_at: string | null;
  arrival_at: string | null;
  final_price: number | null;
  accommodation_pct: number;
  food_pct: number;
  activity_pct: number;
  cancel_before: string | null;
  pay_by: string | null;
  details?: string | null;
  is_tentative: boolean;
}

export type NewRouteBooking = Omit<IRouteBooking, 'id'>;
export type UpdateRouteBooking = Partial<Pick<IRouteBooking,
  'departure_at' | 'arrival_at' | 'final_price' |
  'accommodation_pct' | 'food_pct' | 'activity_pct' |
  'cancel_before' | 'pay_by' | 'details' | 'is_tentative'
>>;

export class RouteBooking {
  id!: string;
  route_id!: string;
  trip_id!: string;
  departure_at           = signal<string | null>(null);
  arrival_at             = signal<string | null>(null);
  final_price            = signal<number | null>(null);
  accommodation_pct      = signal<number>(0);
  food_pct               = signal<number>(0);
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

  readonly foodInclusion = computed((): FoodInclusion => {
    const pct = this.food_pct();
    if (pct <= 0)  return 'excluded';
    if (pct <= 15) return 'breakfast';
    if (pct <= 30) return 'half-board';
    return 'full-board';
  });

  readonly accommodationInclusion = computed((): AccommodationInclusion =>
    this.accommodation_pct() > 0 ? 'included' : 'excluded'
  );

  readonly activityInclusion = computed((): ActivityInclusion =>
    this.activity_pct() > 0 ? 'included' : 'excluded'
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
    if ('accommodation_pct'      in data) this.accommodation_pct.set(data.accommodation_pct ?? 0);
    if ('food_pct'               in data) this.food_pct.set(data.food_pct ?? 0);
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
      accommodation_pct:      this.accommodation_pct(),
      food_pct:               this.food_pct(),
      activity_pct:           this.activity_pct(),
      cancel_before:          this.cancel_before(),
      pay_by:                 this.pay_by(),
      details:                this.details(),
      is_tentative:           this.is_tentative(),
    };
  }
}

export type FoodInclusion = 'excluded' | 'breakfast' | 'half-board' | 'full-board';
export type AccommodationInclusion = 'excluded' | 'included';
export type ActivityInclusion = 'excluded' | 'included';

export const FOOD_PCT: Record<FoodInclusion, number> = {
  'excluded':   0,
  'breakfast':  15,
  'half-board': 30,
  'full-board': 50,
};

export const ACCOMMODATION_PCT: Record<AccommodationInclusion, number> = {
  'excluded': 0,
  'included': 100,
};

export const ACTIVITY_PCT: Record<ActivityInclusion, number> = {
  'excluded': 0,
  'included': 100,
};
