import {Component, computed, effect, inject, input, OnInit, untracked} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';
import { Map } from '../map/map';
import { TripBubble } from '../trip-bubble/trip-bubble';
import { AuthWidget } from '../auth-widget/auth-widget';
import { SidePanel } from '../side-panel/side-panel';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';


@Component({
  selector: 'app-trip-view',
  standalone: true,
  imports: [
    CommonModule,
    Map,
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
  uiService = inject(UiService);
  router = inject(Router);

  tripId = input<string>();
  planId = input<string>();


  constructor() {
    effect(() => this.syncStateWithUrl());
  }


  syncStateWithUrl() {
    const tripId = this.tripId();
    const planId = this.planId();
    const availableTrips = this.tripService.trips();

    untracked(() => {
      if (!tripId) {
        this.tripService.clearTrip();
        return;
      }
      const currentTrip = this.tripService.trip();
      if (currentTrip?.id !== tripId) {
        this.tripService.loadTrip(tripId).subscribe();
      }
      if (availableTrips && !planId) {
        const firstPlanId = availableTrips.find(t => t.id === tripId)?.plans[0]?.id;
        if (firstPlanId) {
          this.router.navigate(['trip', tripId, firstPlanId], { replaceUrl: true });
          return
        }
      }
      if (planId && this.tripService.plan()?.id !== planId) {
        if (currentTrip?.id === tripId) {
          this.tripService.loadPlan(planId);
        }
      }
    });
  }

  ngOnInit(): void {
  }
}
