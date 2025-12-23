import { Routes } from '@angular/router';
import { TripView } from './components/trip-view/trip-view';
// Import your AuthGuard if you have one, or we can add it later

export const routes: Routes = [
  { path: 'trip/:tripId/:planId', component: TripView },
  { path: 'trip/:tripId', component: TripView },
  { path: 'select', component: TripView },
  { path: '', redirectTo: 'select', pathMatch: 'full' }
];
