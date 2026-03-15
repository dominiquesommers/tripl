import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../../services/trip';
import {Season} from '../../../../models/season';
import {COUNTRY_FLAGS} from '../../../../components/map-handler/config/countries.config';

@Component({
  selector: 'app-seasonality',
  imports: [CommonModule],
  templateUrl: './seasonality.html',
  styleUrl: './seasonality.css'
})
export class Seasonality {
  tripService = inject(TripService);
  private hoverTimeout: any;

  readonly monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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
  //
  // readonly totalScore = computed(() => {
  //   const itinerary = this.tripService.plan()?.itinerary() ?? [];
  //   if (itinerary.length === 0) return 0;
  //   const totalDays = itinerary.reduce((sum, v) => sum + v.totalDays(), 0);
  //   const totalSumScore = itinerary.reduce((sum, v) => sum + v.calculateSeasonScore(), 0);
  //   return totalDays > 0 ? totalSumScore / totalDays : 0;
  // });

  ensureReasonsLoaded(season: any) {
    if (season.reasonsLoaded) return;
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    // this.hoverTimeout = setTimeout(() => {
    //   this.tripService.loadSeasonReasons(season.id).subscribe();
    // }, 300);
  }

  cancelHover() {
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
  }

  getReason(season: Season, monthIndex: number): string {
    // const monthKey = this.monthKeys[monthIndex];
    // const score = Math.round(season[monthKey]() * 10);
    // const reason = season[`${monthKey}_reason`]?.() || 'Loading details...';

    return ''; //`Score ${score}/10: ${reason}`;
  }

  // 2. Heatmap Color Logic (Keep your existing math)
  getColor(score: number, alpha: number): string {
    const r = score <= 0.5 ? 222 : Math.round(248 - (248 - 15) * (score - 0.5) * 2);
    const g = score <= 0.5 ? Math.round(25 + (161 - 25) * score * 2) : Math.round(161 + (166 - 161) * (score - 0.5) * 2);
    const b = score <= 0.5 ? 26 : Math.round(28 - (28 - 40) * (score - 0.5) * 2);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getBackground(row: any, monthIndex: number): string {
    const monthKey = this.monthKeys[monthIndex];
    const monthScore = row.season[monthKey]();
    const daysInMonth = row.monthDaysMap[monthKey] || 0;

    const baseColor = this.getColor(monthScore, 0.3);
    const activeColor = this.getColor(monthScore, 1);

    if (daysInMonth === 0) return baseColor;

    // Total days in this specific month (handling leap years via the segments)
    const sampleDate = row.segments[0].start;
    const daysInCalendarMonth = new Date(sampleDate.getFullYear(), monthIndex + 1, 0).getDate();

    // If the user spends the whole month there
    if (daysInMonth >= daysInCalendarMonth) return activeColor;

    // Calculate start/end percentages for the gradient
    let startPercent = 0;
    let endPercent = 100;

    // Find the segment that touches this month
    const firstSegment = row.segments.find((s: any) => s.start.getMonth() === monthIndex);
    const lastSegment = [...row.segments].reverse().find((s: any) => s.end.getMonth() === monthIndex);

    if (firstSegment) {
      // e.g., starts on the 10th: (10-1)/31
      startPercent = ((firstSegment.start.getDate() - 1) / daysInCalendarMonth) * 100;
    }
    if (lastSegment) {
      // e.g., ends on the 20th: 20/31
      endPercent = (lastSegment.end.getDate() / daysInCalendarMonth) * 100;
    }

    return `linear-gradient(to right, ${baseColor} ${startPercent}%, ${activeColor} ${startPercent}%, ${activeColor} ${endPercent}%, ${baseColor} ${endPercent}%)`;
  }
}
