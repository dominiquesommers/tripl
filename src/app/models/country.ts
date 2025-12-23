export interface ICountry { id: string; name: string; }
export class Country implements ICountry {
  id: string; name: string;
  constructor(data: ICountry) { this.id = data.id; this.name = data.name; }
}
