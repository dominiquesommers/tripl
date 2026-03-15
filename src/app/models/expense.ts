import { signal } from '@angular/core';
import {TripService} from '../services/trip';

export interface IExpense {
  id: string;
  amount: number;
  date: string;
  details?: string | null;
  category?: string | null;
  subcategory?: string | null;
  trip_id: string;
  activity_id?: string | null;
  place_note_id?: string | null;
  country_note_id?: string | null;
  trip_note_id?: string | null;
  place_booking_id?: string | null;
  route_booking_id?: string | null;
  place_id?: string | null;
}

export type NewExpense = Omit<IExpense, 'id'>;
export type UpdateExpense = Partial<Pick<IExpense, 'amount' | 'date' | 'details' | 'category' | 'subcategory'>>;

export class Expense {
  id!: string;
  trip_id!: string;
  amount = signal<number>(0);
  date = signal<string>('');
  details = signal<string | null>(null);
  category = signal<string | null>(null);
  subcategory = signal<string | null>(null);
  detailsFetched = signal<boolean>(false);

  // Owner FKs — only one will be set
  activity_id: string | null = null;
  place_note_id: string | null = null;
  country_note_id: string | null = null;
  trip_note_id: string | null = null;
  place_booking_id: string | null = null;
  route_booking_id: string | null = null;
  place_id: string | null = null;

  constructor(
    data: IExpense,
    private tripService: TripService
  ) {
    this.id = data.id;
    this.trip_id = data.trip_id;
    this.activity_id      = data.activity_id      ?? null;
    this.place_note_id    = data.place_note_id    ?? null;
    this.country_note_id  = data.country_note_id  ?? null;
    this.trip_note_id     = data.trip_note_id     ?? null;
    this.place_booking_id = data.place_booking_id ?? null;
    this.route_booking_id = data.route_booking_id ?? null;
    this.place_id         = data.place_id         ?? null;
    this.update(data);
    // details is only present in lazy-loaded fetches
    this.detailsFetched.set('details' in data && data.details !== undefined);
  }

  update(data: Partial<IExpense>) {
    if ('amount'     in data) this.amount.set(data.amount ?? 0);
    if ('date'       in data) this.date.set(data.date ?? '');
    if ('details'    in data) { this.details.set(data.details ?? null); this.detailsFetched.set(true); }
    if ('category'   in data) this.category.set(data.category ?? null);
    if ('subcategory' in data) this.subcategory.set(data.subcategory ?? null);
  }

  toJSON(): IExpense {
    return {
      id:               this.id,
      trip_id:          this.trip_id,
      amount:           this.amount(),
      date:             this.date(),
      details:          this.details(),
      category:         this.category(),
      subcategory:      this.subcategory(),
      activity_id:      this.activity_id,
      place_note_id:    this.place_note_id,
      country_note_id:  this.country_note_id,
      trip_note_id:     this.trip_note_id,
      place_booking_id: this.place_booking_id,
      route_booking_id: this.route_booking_id,
      place_id:         this.place_id,
    };
  }
}
