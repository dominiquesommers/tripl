import {computed} from '@angular/core';
import {TripService} from '../services/trip';
import {CostBreakdown, CostComparison} from './cost';

export interface ICountry { id: string; name: string; }
export class Country implements ICountry {
  id: string;
  name: string;

  readonly notes = computed(() =>
    [...this.tripService.trip()?.countryNotes().values() ?? []].filter(a => a.country_id === this.id) ?? []
  );

  readonly places = computed(() =>
    this.tripService.trip()?.placesArray().filter(p => p.country_id === this.id) ?? []
  );

  readonly routes = computed(() =>
    this.tripService.trip()?.routesArray().filter(r => r.source.country_id === this.id && !r.isCrossCountry()) ?? []
  );

  readonly inItinerary = computed((): boolean => this.places().some(p => p.inItinerary()));

  readonly oneTimeCost = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();
    const est = new CostBreakdown(
      0, 0, 0, 0,
      this.notes().filter(n => n.included()).reduce((sum, n) => sum + (n.estimated_cost() ?? 0), 0)
    );
    const act = est.clone();
    // TODO add actual costs.
    return new CostComparison(est, act);
  });

  readonly cost = computed<CostComparison>(() => {
    if (!this.inItinerary()) return CostComparison.empty();
    let total = this.oneTimeCost();
    this.places().forEach(p => {
      total = total.add(p.cost());
    });
    this.routes().forEach(r => {
      total = total.add(r.cost());
    });
    return total;
  });

  constructor(
    data: ICountry,
    private tripService: TripService
  ) {
    this.id = data.id.toString();
    this.name = data.name;
  }
}
