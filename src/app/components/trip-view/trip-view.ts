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
  uiService = inject(UiService);
  router = inject(Router);

  tripId = input<string>();
  planId = input<string>();


  constructor() {
    effect(() => this.syncTripWithUrl());
    effect(() => this.syncPlanWithUrl());
  }

  syncTripWithUrl() {
    const tripId = this.tripId();
    if (!tripId) {
      this.tripService.clearTrip();
      return;
    }
    const currentTrip = this.tripService.trip();
    if (!currentTrip || currentTrip.id !== tripId) {
      console.log('Loading trip', tripId);
      this.tripService.loadTrip(tripId).subscribe();
    }
  }

  syncPlanWithUrl() {
    const tripId = this.tripId();
    const planId = this.planId();
    const currentTrip = this.tripService.trip();
    const availableTrips = this.tripService.trips();

    if (!tripId || !currentTrip || currentTrip.id !== tripId) return;

    // Redirect to first plan if none in URL
    if (!planId && availableTrips) {
      const firstPlanId = availableTrips.find(t => t.id === tripId)?.plans[0]?.id;
      if (firstPlanId) {
        this.router.navigate(['trip', tripId, firstPlanId], { replaceUrl: true });
      }
      return;
    }

    // Load plan if it exists and isn't loaded yet
    if (planId && this.tripService.plan()?.id !== planId) {
      console.log('Trip ready, loading plan:', planId);
      this.tripService.loadPlan(planId).subscribe();
    }
  }

  ngOnInit(): void {
  }
}
