import {Injectable, inject, signal, WritableSignal, computed, effect, untracked} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {map, Subject} from 'rxjs';
import {TripService} from './trip';
import {COUNTRY_FLAGS} from '../components/map-handler/config/countries.config';


@Injectable({ providedIn: 'root' })
export class SeasonalityService {
  tripService = inject(TripService);

  readonly rows = computed(() => {
      const plan = this.tripService.plan();
      if (!plan) return [];
  
      const itinerary = plan.itinerary();
      const rows: any[] = [];
  
      itinerary.forEach((visit) => {
        const days = visit.totalDays();
        if (days <= 0) return;
  
        const season = visit.place.season;
        if (!season) return;
  
        const lastRow = rows[rows.length - 1];
  
        // Check if this visit belongs to the same season block as the previous visit
        if (lastRow && lastRow.season.id === season.id) {
          lastRow.days += days;
          lastRow.sumScore += visit.calculateSeasonScore();
          lastRow.segments.push({ start: visit.entryDate(), end: visit.exitDate() });
  
          Object.entries(visit.monthDays()).forEach(([m, d]) => {
            lastRow.monthDaysMap[m] = (lastRow.monthDaysMap[m] || 0) + d;
          });
        } else {
          const country = season.country;
          const flag = COUNTRY_FLAGS[country.name] || COUNTRY_FLAGS['undefined'];
          rows.push({
            season,
            flag: flag,
            abbr: season.description_abbreviation() || '',
            countryName: country?.name,
            days: days,
            sumScore: visit.calculateSeasonScore(),
            monthDaysMap: { ...visit.monthDays() },
            segments: [{ start: visit.entryDate(), end: visit.exitDate() }]
          });
        }
      });
  
      return rows;
    });

  readonly totalScore = computed(() => {
    const currentRows = this.rows();
    const totalDays = currentRows.reduce((acc, r) => acc + r.days, 0);
    const totalSum = currentRows.reduce((acc, r) => acc + r.sumScore, 0);
    return totalDays > 0 ? totalSum / totalDays : 0;
  });
}