import {Injectable, inject, computed} from '@angular/core';
import {TripService} from './trip';
import { CostComparison } from '../models/cost';
import { Place } from '../models/place';
import { Country } from '../models/country';


@Injectable({ providedIn: 'root' })
export class CostService {
  tripService = inject(TripService);

  public total = computed<CostComparison>(() => {
    const trip = this.tripService.trip();
    const plan = this.tripService.plan();
    if (!trip || !plan) return CostComparison.empty();
    const visits = plan.itinerary();
    const visitedPlaces = new Set<Place>();
    const visitedCountries = new Set<Country>();
    let current = CostComparison.empty();
    let total = CostComparison.empty();
    visits.forEach((visit) => {
    if (!visitedPlaces.has(visit.place)) {
        visitedPlaces.add(visit.place);
        current = current.add(visit.place.oneTimeCost());
    }
    if (!visitedCountries.has(visit.place.country)) {
        visitedCountries.add(visit.place.country);
        current = current.add(visit.place.country.oneTimeCost());
    }
    current = current.add(visit.cost()); // Could separate this over the nights, now all paid on arrival.
    total = total.add(current);
    const traverse = visit.nextTraverse();
    if (traverse) {
        current = traverse.cost_();
    }
    });
    return total;
});
}