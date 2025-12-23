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

export class Season implements ISeason {
  id!: string;
  country_id!: string;
  description: string = '';
  description_abbreviation: string = '';
  jan!: number; feb!: number; mar!: number; apr!: number;
  may!: number; jun!: number; jul!: number; aug!: number;
  sep!: number; oct!: number; nov!: number; dec!: number;
  jan_reason: string = ''; feb_reason: string = ''; mar_reason: string = '';
  apr_reason: string = ''; may_reason: string = ''; jun_reason: string = '';
  jul_reason: string = ''; aug_reason: string = ''; sep_reason: string = '';
  oct_reason: string = ''; nov_reason: string = ''; dec_reason: string = '';

  months: number[];
  reasons: string[];

  constructor(data: ISeason) {
    Object.assign(this, data);
    this.id = data.id;
    this.description = data.description ?? '';
    this.country_id = data.country_id;
    this.months = [
      data.jan, data.feb, data.mar, data.apr, data.may, data.jun,
      data.jul, data.aug, data.sep, data.oct, data.nov, data.dec
    ];
    this.reasons = [
      data.jan_reason ?? '', data.feb_reason ?? '', data.mar_reason ?? '', data.apr_reason ?? '', data.may_reason ?? '', data.jun_reason ?? '',
      data.jul_reason ?? '', data.aug_reason ?? '', data.sep_reason ?? '', data.oct_reason ?? '', data.nov_reason ?? '', data.dec_reason ?? ''
    ];
  }
}
