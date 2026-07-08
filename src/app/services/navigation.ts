import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  readonly tripId = signal<string | null>(null);
  readonly planId = signal<string | null>(null);

  setTripId(id: string | null) { this.tripId.set(id); }
  setPlanId(id: string | null) { this.planId.set(id); }
}