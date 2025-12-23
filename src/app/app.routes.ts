import { Routes } from '@angular/router';
import { TripView } from './components/trip-view/trip-view';
// Import your AuthGuard if you have one, or we can add it later

import { Component } from '@angular/core';

@Component({ selector: 'app-dummy', standalone: true, template: '<h1>Test</h1>' })
class DummyComponent {}

export const routes: Routes = [
  { path: 'trip/:tripId/:planId', component: TripView },
  { path: 'trip/:tripId', component: TripView },
  // { path: '', component: DummyComponent }
];

  // Wildcard: if they type something wrong, send them to the root
  // { path: '**', redirectTo: '' }

  // { path: 'trip/:tripId/:planId', component: TripView },
  // { path: 'trip/:tripId', component: TripView },
  // { path: '', component: TripView },
  // { path: '', redirectTo: 'select', pathMatch: 'full' }
// ];
