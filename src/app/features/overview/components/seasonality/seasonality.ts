import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TripService } from '../../../../services/trip';
import {Season} from '../../../../models/season';
import {COUNTRY_FLAGS} from '../../../../components/map-handler/config/countries.config';
import { SeasonalityService } from '../../../../services/seasonality';

@Component({
  selector: 'app-seasonality',
  imports: [CommonModule],
  templateUrl: './seasonality.html',
  styleUrl: './seasonality.css'
})
export class Seasonality {
  tripService = inject(TripService);
  seasonalityService = inject(SeasonalityService);
  private hoverTimeout: any;

  readonly monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

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
