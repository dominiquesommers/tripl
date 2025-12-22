import { Routes } from '@angular/router';
import { TripView } from './components/trip-view/trip-view';
// Import your AuthGuard if you have one, or we can add it later

export const routes: Routes = [
  // When no trip is selected, show the selection menu (we can reuse trip-view or a dashboard)
  { path: '', redirectTo: 'select', pathMatch: 'full' },
  { path: 'select', component: TripView },

  // The main app routes with parameters
  { path: 'trip/:tripId', component: TripView },
  { path: 'trip/:tripId/:planId', component: TripView },

  // Fallback
  // { path: '**', redirectTo: 'select' }
];
