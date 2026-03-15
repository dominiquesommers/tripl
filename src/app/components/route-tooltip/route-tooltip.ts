import {Component, computed, Input, input, Signal} from '@angular/core';
import { Route } from '../../models/route';

@Component({
  selector: 'app-route-tooltip',
  imports: [],
  standalone: true,
  templateUrl: './route-tooltip.html',
  styleUrl: './route-tooltip.css',
})
export class RouteTooltip {
  @Input({ required: true }) route!: Signal<Route | null>;

  sortedTraverses = computed(() => {
    return this.route()?.traverses()
      .filter(t => t.entryDate() !== null)
      .sort((a, b) => {
        const dateA = a.entryDate()?.getTime() ?? 0;
        const dateB = b.entryDate()?.getTime() ?? 0;
        return dateA - dateB;
      }) ?? [];
  });

  formatDuration(hours: number): string {
    if (!hours) return '';
    // If you have partial hours (e.g., 2.5), this converts to "2h 30m"
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);

    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  formatDistance(kms: number): string {
    if (!kms) return '';
    return `${Math.round(kms)} km`
  }
}
