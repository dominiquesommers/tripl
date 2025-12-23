import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { AuthService } from '../../services/auth';
import { TripService } from '../../services/trip';
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
  private lastUserId: string | null = null;
  private lastTripId: string | null = null;
  private lastPlanId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    public tripService: TripService
  ) {}

  ngOnInit(): void {
    combineLatest({
      user: this.authService.user$,
      params: this.route.paramMap
    }).subscribe(({ user, params }) => {
      const tripId = params.get('tripId');
      const planId = params.get('planId');

      if (user?.uid !== this.lastUserId) {
        this.tripService.clearAllState();
        this.lastTripId = null;
        this.lastPlanId = null;
        this.lastUserId = user?.uid ?? null;
      }

      if (!user) return;

      if (!this.tripService.hasUserIndex) {
        this.tripService.loadUserIndex();
      }

      if (tripId && tripId !== this.lastTripId) {
        this.lastTripId = tripId;
        this.lastPlanId = planId;
        this.tripService.loadTrip(tripId).subscribe(() => {
          if (planId) this.tripService.loadPlan(planId);
        });
      } else if (planId && planId !== this.lastPlanId) {
        this.lastPlanId = planId;
        this.tripService.loadPlan(planId);
      }
    });
  }

  // openTrip(tripId: string) {
  //   this.router.navigate(['trip', tripId]);
  // }
}
