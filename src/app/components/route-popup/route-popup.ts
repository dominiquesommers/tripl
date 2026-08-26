import {Component, computed, inject, signal, input, output} from '@angular/core';
import {Route, UpdateRoute} from '../../models/route';
import {ROUTE_COLORS} from '../map-handler/config/map-styles.config';
import {EditableBadge} from '../ui/editable-badge/editable-badge';
import {LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../services/trip';
import {AuthService} from '../../services/auth';
import {UiService} from '../../services/ui';
import {Place} from '../../models/place';
import {OverlayMenu} from '../ui/overlay-menu/overlay-menu';
import {OverlayMenuAction} from '../../models/overlay-menu';
import { ROUTE_ICONS } from '../map-handler/config/map-styles.config';
import { NotificationService } from '../../services/notification';


@Component({
  selector: 'app-route-popup',
  standalone: true,
  imports: [LucideAngularModule, EditableBadge, OverlayMenu],
  templateUrl: './route-popup.html',
  styleUrl: './route-popup.css',
})
export class RoutePopup {
  readonly tripService = inject(TripService);
  readonly uiService = inject(UiService);
  readonly notificationService = inject(NotificationService);
  authService = inject(AuthService);

  route = input.required<Route>();

  readonly routeMenuActions = computed((): OverlayMenuAction[] => {
    const actions: OverlayMenuAction[] = [];
    if (!this.hasReverseRoute()) {
      actions.push(
        {
          icon: 'repeat',
          label: 'Add reverse route',
          action: () => this.addReverseRoute(),
        },
      );
    }
    actions.push(
      {
        icon: 'trash-2',
        label: 'Delete route',
        action: () => this.delete(),
        className: 'delete-option',
      },
    );

    return actions;
  });

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
    return s;
  });

  updateRoute(route: Route, patch: UpdateRoute) {
    this.tripService.updateRoute(route.id, patch).subscribe();
  }

  addReverseRoute() {
    const route = this.route();
    this.tripService.addRoute(route.targetId, route.sourceId, route.type(), route.distance(), route.duration(), route.estimated_cost() ?? undefined).subscribe({
      next: (route) => {
        if (route) this.uiService.selectRoute(route.id);
      },
      error: (err) => console.error('Failed to add reverse route:', err)
    });
  }

  delete() {
    const route = this.route();
    const traverseCount = route.traverses().length;
    const traverseLabel = traverseCount === 1 ? 'traverse' : 'traverses';
    // TODO this should also check for traverses from other plans in this trip.
    const message = `Are you sure you want to remove this route? This will also delete ${traverseCount} associated ${traverseLabel}.`;
    this.notificationService.confirmModal(
      {
        title: 'Remove route',
        message: message,
        confirmLabel: 'Remove',
        isDanger: true
      },
      () => {
        this.tripService.removeRoute(route).subscribe({
          next: () => this.uiService.clearSelection(),
          error: err => console.error('Failed to remove route', err),
        });
      }
    );
  }

  readonly reverseRoute = computed(() => {
    const current = this.route();
    return this.tripService.trip()?.routesArray().find(r =>
      r.sourceId === current.targetId &&
      r.targetId === current.sourceId &&
      r.type() === current.type()
    );
  });

  readonly hasReverseRoute = computed(() => !!this.reverseRoute());

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
    return ROUTE_ICONS[type as keyof typeof ROUTE_ICONS];
  }

  getRouteColor(type: string | undefined | null): string {
    return ROUTE_COLORS[type as keyof typeof ROUTE_COLORS];
  }
}
