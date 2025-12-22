import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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
export class TripView {
  constructor(
    public authService: AuthService,
    public tripService: TripService,
    private router: Router
  ) {}

  openTrip(tripId: string) {
    this.router.navigate(['trip', tripId]);
  }
}
