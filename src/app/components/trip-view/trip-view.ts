import {Component, computed, effect, inject, input, OnInit, untracked} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';
import { MapHandler } from '../map-handler/map-handler';
import { TripBubble } from '../trip-bubble/trip-bubble';
import { AuthWidget } from '../auth-widget/auth-widget';
import { SidePanel } from '../side-panel/side-panel';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';
import { UserPlan } from '../../models/user';
import { NavigationService } from '../../services/navigation';


@Component({
  selector: 'app-trip-view',
  standalone: true,
  imports: [
    CommonModule,
    MapHandler,
    TripBubble,
    AuthWidget,
    SidePanel,
    LoadingSpinner
  ],
  templateUrl: './trip-view.html',
  styleUrl: './trip-view.css',
})
export class TripView implements OnInit {
  tripService = inject(TripService);
  navigationService = inject(NavigationService);
  uiService = inject(UiService);
  router = inject(Router);

  tripId = input<string>();
  planId = input<string>();


  constructor() {
    effect(() => this.navigationService.setTripId(this.tripId() ?? null));
    effect(() => this.navigationService.setPlanId(this.planId() ?? null));

    effect(() => {
      const tripId = this.tripId();
      const planId = this.planId();
      const currentTrip = this.tripService.trip();
      const availableTrips = this.tripService.trips();

      if (!tripId || !currentTrip || currentTrip.id !== tripId) return;

      if (!planId && availableTrips) {
        const trip = availableTrips.find(t => t.id === tripId);
        const firstPlanId = trip?.plans().reduce((prev: UserPlan, curr: UserPlan) =>
          curr.priority() < prev.priority() ? curr : prev
        ).id;
        if (firstPlanId) {
          untracked(() => {
            console.log('No plan in URL, redirecting to default:', firstPlanId);
            this.router.navigate(['trip', tripId, firstPlanId], { replaceUrl: true });
          });
        }
      }
    });
  }

  ngOnInit(): void {
  }
}
