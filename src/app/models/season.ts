import {computed, signal, WritableSignal} from '@angular/core';

export interface ISeason {
  id: string;
  country_id: string;
  description?: string;
  description_abbreviation?: string | null;
  jan: number; feb: number; mar: number; apr: number;
  may: number; jun: number; jul: number; aug: number;
  sep: number; oct: number; nov: number; dec: number;
  jan_reason?: string | null; feb_reason?: string | null; mar_reason?: string | null;
  apr_reason?: string | null; may_reason?: string | null; jun_reason?: string | null;
  jul_reason?: string | null; aug_reason?: string | null; sep_reason?: string | null;
  oct_reason?: string | null; nov_reason?: string | null; dec_reason?: string | null;
}

export type NewSeason = Omit<ISeason, 'id'>;
export type UpdateSeason = Partial<Omit<ISeason, 'id' | 'country_id'>>;


const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
type MonthKey = typeof MONTH_KEYS[number];
type MonthReasonKey = `${MonthKey}_reason`;
const MONTH_REASON_KEYS: MonthReasonKey[] = MONTH_KEYS.map(m => `${m}_reason`) as MonthReasonKey[];


export class Season {
  id!: string;
  country_id!: string;
  description = signal<string>('');
  description_abbreviation = signal<string>('');
  jan = signal<number>(0); feb = signal<number>(0);
  mar = signal<number>(0); apr = signal<number>(0);
  may = signal<number>(0); jun = signal<number>(0);
  jul = signal<number>(0); aug = signal<number>(0);
  sep = signal<number>(0); oct = signal<number>(0);
  nov = signal<number>(0); dec = signal<number>(0);
  jan_reason = signal<string>(''); feb_reason = signal<string>('');
  mar_reason = signal<string>(''); apr_reason = signal<string>('');
  may_reason = signal<string>(''); jun_reason = signal<string>('');
  jul_reason = signal<string>(''); aug_reason = signal<string>('');
  sep_reason = signal<string>(''); oct_reason = signal<string>('');
  nov_reason = signal<string>(''); dec_reason = signal<string>('');

  months = computed(() => MONTH_KEYS.map(k => (this[k] as WritableSignal<number>)()));
  reasons = computed(() => MONTH_REASON_KEYS.map(k => (this[k] as WritableSignal<string>)()));

  constructor(data: ISeason) {
    this.id = data.id.toString();
    this.country_id = data.country_id.toString();
    this.update(data);
  }

  update(data: Partial<ISeason>) {
    [...MONTH_KEYS, ...MONTH_REASON_KEYS].forEach(key => {
      if (key in data) {
        (this[key] as WritableSignal<any>).set(data[key as keyof ISeason] ?? (key.endsWith('_reason') ? '' : 0));
      }
    });
    if ('description' in data) this.description.set(data.description ?? '');
    if ('description_abbreviation' in data) this.description_abbreviation.set(data.description_abbreviation ?? '');
  }

  toJSON(): ISeason {
    const json: any = {
      id: this.id,
      country_id: this.country_id,
      description: this.description(),
      description_abbreviation: this.description_abbreviation()
    };
    MONTH_KEYS.forEach(k => {
      json[k] = (this[k] as WritableSignal<number>)();
    });
    MONTH_REASON_KEYS.forEach(k => {
      json[k] = (this[k] as WritableSignal<string>)();
    });

    return json as ISeason;
  }
}
