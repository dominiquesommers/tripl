import {Component, computed, inject, input, output} from '@angular/core';
import {Route, RouteType, UpdateRoute} from '../../models/route';
import {ROUTE_COLORS} from '../map-handler/config/map-styles.config';
import {EditableBadge} from '../ui/editable-badge/editable-badge';
import {LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../services/trip';
import {AuthService} from '../../services/auth';
import {UiService} from '../../services/ui';
import {Place} from '../../models/place';

@Component({
  selector: 'app-route-popup',
  standalone: true,
  imports: [LucideAngularModule, EditableBadge],
  templateUrl: './route-popup.html',
  styleUrl: './route-popup.css',
})
export class RoutePopup {
  readonly tripService = inject(TripService);
  readonly uiService = inject(UiService);
  authService = inject(AuthService);

  route = input.required<Route>();

  // TODO move to config.
  private readonly routeIconMap: Record<string, string> = {
    'flying': 'plane',
    'bus': 'bus',
    'train': 'train-front',
    'driving': 'car',
    'boat': 'ship',
  };

  distance = computed(() => {
    return Math.ceil(this.route().distance());
  });

  duration = computed(() => {
    return Math.ceil(this.route().duration());
  });

  sortedTraverses = computed(() => {
    return this.route()?.traverses()
      .filter(t => t.entryDate() !== null)
      .sort((a, b) => {
        const dateA = a.entryDate()?.getTime() ?? 0;
        const dateB = b.entryDate()?.getTime() ?? 0;
        return dateA - dateB;
      }) ?? [];
  });

  readonly traverseSummary = computed(() => {
    const parts = this.sortedTraverses().map(t => {
      const entry = t.entryDateString();
      const exit = t.exitDateString();
      return entry === exit ? entry : `${entry}-${exit}`;
    });
    const s = parts.length > 0 ? `(${parts.join(', ')})` : '';
    console.log(s);
    return s;
  });

  updateRoute(route: Route, patch: UpdateRoute) {
    this.tripService.updateRoute(route.id, patch).subscribe();
  }

  onFlyTo(place?: Place | null) {
    if (!place) return;
    this.uiService.triggerFlyTo({center: [place.lng, place.lat]});
    const firstVisit = place.visits;
    const visits = place.visits();
    if (!visits) return;

    const sortedVisits = [...visits].sort((a, b) => {
      if (a.included() !== b.included()) {
        return a.included() ? -1 : 1;
      }
      const dateA = a.entryDate()?.getTime() || Infinity;
      const dateB = b.entryDate()?.getTime() || Infinity;
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      return a.id.localeCompare(b.id);
    });

    this.uiService.selectVisit(sortedVisits[0].id);
  }

  highlightTraverse(route?: Route | null) {
    this.uiService.hoveredRoute.set(route ?? null);
  }

  clearTraverseHighlight() {
    this.uiService.hoveredRoute.set(null);
  }

  highlightPlace(place?: Place | null) {
    this.uiService.hoveredPlace.set(place ?? null);
  }

  clearPlaceHighlight() {
    this.uiService.hoveredPlace.set(null);
  }

  getRouteIcon(type: string | undefined | null): string {
    if (!type) return 'milestone';
    return this.routeIconMap[type.toLowerCase()] || 'milestone';
  }

  getRouteColor(type: string | undefined | null): string {
    if (!type) return ROUTE_COLORS.undefined;
    // @ts-ignore
    return ROUTE_COLORS[type.toLowerCase()] || ROUTE_COLORS.undefined;
  }
}
