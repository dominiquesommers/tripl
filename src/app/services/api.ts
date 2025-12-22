import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'https://travelmap-307804410649.europe-west1.run.app/';

  constructor(private http: HttpClient) {}

  getSyncData(userId: string, tripId?: string, planId?: string): Observable<any> {
    const trips = [
      { id: 'wereldreis', name: 'Wereldreis' },
      { id: 'test', name: 'Testreis' }
    ];
    const plans = [
      { id: 'v1', name: 'v1', priority: 1 },
      { id: 'v2', name: 'v2 (copy 2) (copy 2) (copy 2) (copy 2)', priority: 2 }
    ];
    const mockResponse = {
      userTrips: [
        { id: 'wereldreis', name: 'Wereldreis' },
        { id: 'test', name: 'Testreis' }
      ],
      activeTrip: tripId ? {
        id: tripId,
        name: tripId === 'wereldreis' ? 'Wereldreis' : 'Testreis',
        plans: plans,
        pins: [
          { lat: 48.8566, lng: 2.3522, title: 'Paris' }
        ]
      } : null,
      activePlan: planId ? plans.find(plan => plan.id === planId) : null
    };

    // 'of' turns the object into an Observable
    // 'delay(2000)' simulates a 2-second network lag so you can see the spinner!
    return of(mockResponse).pipe(delay(2000));

    // const payload = { userId, tripId, planId };
    // return this.http.post(`${this.baseUrl}/sync_user_data`, payload);
  }
}
