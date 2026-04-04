import {computed, signal} from '@angular/core';
import {TripService} from '../services/trip';

export interface IPlaceBooking {
  id: string;
  place_id: string;
  trip_id: string;
  check_in: string | null;
  check_out: string | null;
  final_price: number | null;
  food_pct: number;
  cancel_before: string | null;
  pay_by: string | null;
  details?: string | null;
  is_tentative: boolean;
}


export type NewPlaceBooking = Omit<IPlaceBooking, 'id'>;
export type UpdatePlaceBooking = Partial<Pick<IPlaceBooking,
  'check_in' | 'check_out' | 'final_price' |
  'food_pct' | 'cancel_before' | 'pay_by' | 'details' | 'is_tentative'
>>;

export class PlaceBooking {
  id!: string;
  place_id!: string;
  trip_id!: string;
  check_in      = signal<string | null>(null);
  check_out     = signal<string | null>(null);
  final_price   = signal<number | null>(null);
  food_pct      = signal<number>(0);
  cancel_before = signal<string | null>(null);
  pay_by        = signal<string | null>(null);
  details       = signal<string | null>(null);
  is_tentative  = signal<boolean>(false);
  detailsFetched = signal<boolean>(false);

  readonly expenses = computed(() =>
    Array.from(this.tripService.trip()?.expenses().values() ?? [])
      .filter(e => e.place_booking_id === this.id)
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

  constructor(
    data: IPlaceBooking,
    private tripService: TripService
  ) {
    this.id       = data.id;
    this.place_id = data.place_id;
    this.trip_id  = data.trip_id;
    this.update(data);
    this.detailsFetched.set('details' in data && data.details !== undefined);
  }

  update(data: Partial<IPlaceBooking>) {
    if ('check_in'      in data) this.check_in.set(data.check_in ?? null);
    if ('check_out'     in data) this.check_out.set(data.check_out ?? null);
    if ('final_price'   in data) this.final_price.set(data.final_price ?? null);
    if ('food_pct'      in data) this.food_pct.set(data.food_pct ?? 0);
    if ('cancel_before' in data) this.cancel_before.set(data.cancel_before ?? null);
    if ('pay_by'        in data) this.pay_by.set(data.pay_by ?? null);
    if ('details'       in data) { this.details.set(data.details ?? null); this.detailsFetched.set(true); }
    if ('is_tentative'  in data) this.is_tentative.set(data.is_tentative ?? false);
  }

  toJSON(): IPlaceBooking {
    return {
      id:            this.id,
      place_id:      this.place_id,
      trip_id:       this.trip_id,
      check_in:      this.check_in(),
      check_out:     this.check_out(),
      final_price:   this.final_price(),
      food_pct:      this.food_pct(),
      cancel_before: this.cancel_before(),
      pay_by:        this.pay_by(),
      details:       this.details(),
      is_tentative:  this.is_tentative(),
    };
  }
}


export type FoodInclusion = 'excluded' | 'breakfast' | 'half-board' | 'full-board';
export const FOOD_PCT: Record<FoodInclusion, number> = {
  'excluded':   0,
  'breakfast':  15,
  'half-board': 30,
  'full-board': 50,
};
