import { Routes } from '@angular/router';
import { TripView } from './components/trip-view/trip-view';


export const routes: Routes = [
  { path: '', component: TripView },
  { path: 'trip/:tripId', component: TripView },
  { path: 'trip/:tripId/:planId', component: TripView }
];
