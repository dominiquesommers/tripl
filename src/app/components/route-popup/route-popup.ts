import {Component, computed, inject, input, output} from '@angular/core';
import {Route, RouteType, UpdateRoute} from '../../models/route';
import {ROUTE_COLORS} from '../map-handler/config/map-styles.config';
import {EditableBadge} from '../ui/editable-badge/editable-badge';
import {LucideAngularModule } from 'lucide-angular';
import {TripService} from '../../services/trip';

@Component({
  selector: 'app-route-popup',
  standalone: true,
  imports: [LucideAngularModule, EditableBadge],
  templateUrl: './route-popup.html',
  styleUrl: './route-popup.css',
})
export class RoutePopup {
  readonly tripService = inject(TripService);

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

  updateRoute(route: Route, patch: UpdateRoute) {
    this.tripService.updateRoute(route.id, patch);
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
