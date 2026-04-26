import {computed} from '@angular/core';
import {TripService} from '../services/trip';
import {CostBreakdown, CostComparison} from './cost';
import {COUNTRY_ABBREVIATIONS, COUNTRY_FLAGS} from '../components/map-handler/config/countries.config';

export interface ICountry { id: string; name: string; }
export class Country implements ICountry {
  id: string;
  name: string;
  abbreviation: string;
  flag: string;

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

  readonly visits = computed(() => {
    const plan = this.tripService.plan();
    if (!plan) return [];
    return plan.itinerary().filter(v => v.place.country.id === this.id);
  });

  // readonly numberOfDaysVisited = computed(() => {
  //   return this.visits().reduce((sum, v) => sum + v.totalDays(), 0);
  // });
  // TODO check if we want to have this one (see below), or have them both separated.
  readonly numberOfDaysVisited = computed(() => {
    return this.countryIntervals().reduce((sum, interval) =>
      sum + interval.numberOfConsecutiveDays, 0
    );
  });

  readonly countryIntervals = computed(() => {
    const visits = this.visits();
    if (visits.length === 0) return [];

    const intervals: { entryDate: Date; exitDate: Date; numberOfConsecutiveDays: number }[] = [];

    // Initialize with the first visit
    let currentEntry = visits[0].entryDate()!;
    let currentExit = visits[0].exitDate()!;
    let currentDays = visits[0].totalDays();

    for (let i = 0; i < visits.length; i++) {
      const v = visits[i];
      const nextT = v.nextTraverse();

      // 1. Handle Transit within the same country visit
      if (nextT && !nextT.route.isCrossCountry()) {
        const transitNights = nextT.route.nights();
        if (transitNights > 0) {
          // Add transit time to current segment
          currentDays += transitNights;
          // The exit date for this segment is pushed by the transit nights
          currentExit = new Date(currentExit.getTime() + transitNights * 24 * 60 * 60 * 1000);
        }
      }

      // 2. Determine if we should peek at the NEXT visit to merge or break
      const nextVisit = visits[i + 1];

      if (nextVisit) {
        const vNextEntry = nextVisit.entryDate()!;

        // If the next visit starts where our (possibly extended) exit is, merge it
        if (vNextEntry.getTime() === currentExit.getTime()) {
          currentDays += nextVisit.totalDays();
          currentExit = nextVisit.exitDate()!;
        } else {
          // Gap detected (or cross-country traverse occurred)
          intervals.push({
            entryDate: currentEntry,
            exitDate: currentExit,
            numberOfConsecutiveDays: currentDays
          });
          // Start fresh with the next visit
          currentEntry = nextVisit.entryDate()!;
          currentExit = nextVisit.exitDate()!;
          currentDays = nextVisit.totalDays();
        }
      }
    }

    // Push the final segment (if not already pushed by the loop)
    // Logic check: The loop above handles the push inside the 'else'.
    // We need to ensure the very last sequence is captured.
    if (intervals.length === 0 || intervals[intervals.length - 1].exitDate !== currentExit) {
      intervals.push({
        entryDate: currentEntry,
        exitDate: currentExit,
        numberOfConsecutiveDays: currentDays
      });
    }

    return intervals;
  });

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
    this.abbreviation = COUNTRY_ABBREVIATIONS[this.name];
    this.flag = COUNTRY_FLAGS[this.name];
  }
}
