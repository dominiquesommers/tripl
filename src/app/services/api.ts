import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { AuthService } from './auth';
import { ITrip } from '../models/trip';
import { IPlace } from '../models/place';
import { IPlan } from '../models/plan';
import { IVisit } from '../models/visit';
import { ICountry } from '../models/country';
import { ISeason } from '../models/season';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'https://travelmap-307804410649.europe-west1.run.app/';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private d = 800; // Simulated latency (ms)

  // 1. User Index (Navigation)
  getUserTrips() {
    const userId: string | undefined = this.authService.getCurrentUserValue()?.uid;
    const mock = [
      {
        id: 't1', name: 'Summer in Europe',
        plans: [
          { id: 'p1', name: 'Budget Backpacking', priority: 1 },
          { id: 'p2', name: 'Luxury Route', priority: 2 }
        ]
      },
      {
        id: 't2', name: 'Japan Explorer',
        plans: [{ id: 'p3', name: 'Standard Plan', priority: 1 }]
      }
    ];
    return of(mock).pipe(delay(this.d));
  }

  // 2. Trip Metadata
  getTrip(id: string) {
    const mock = { id, name: id === 't1' ? 'Summer in Europe' : 'Japan Explorer' };
    return of(mock).pipe(delay(this.d));
  }

  // 3. Places (The Pool)
  getPlaces(tripId: string) {
    const mock = [
      { id: 'loc1', trip_id: tripId, name: 'Paris', country_id: 'fr', season_id: 's1', lat: 48.85, lng: 2.35 },
      { id: 'loc2', trip_id: tripId, name: 'Berlin', country_id: 'de', season_id: 's2', lat: 52.52, lng: 13.40 },
      { id: 'loc3', trip_id: tripId, name: 'Rome', country_id: 'it', season_id: 's3', lat: 41.90, lng: 12.49 }
    ];
    return of(mock).pipe(delay(this.d));
  }

  // 4. Plan Metadata
  getPlan(id: string) {
    const mock = { id, name: 'Selected Plan', lat: 48.0, lng: 10.0, zoom: 4, start_date: '2026-05-23', note: '', priority: 1, trip_id: 't1' };
    return of(mock).pipe(delay(this.d));
  }

  // 5. Visits (The Itinerary)
  getVisits(planId: string) {
    const mock = [
      { id: 'v1', plan_id: planId, place_id: 'loc1', nights: 3, included: true },
      { id: 'v2', plan_id: planId, place_id: 'loc2', nights: 2, included: true }
    ];
    return of(mock).pipe(delay(this.d));
  }

  // 6. Reference Data
  getCountries() {
    const mock = [
      { id: 'fr', name: 'France', code: 'FR' },
      { id: 'de', name: 'Germany', code: 'DE' },
      { id: 'it', name: 'Italy', code: 'IT' }
    ];
    return of(mock).pipe(delay(this.d));
  }

  getSeasons() {
    const mock = [
      { id: 's1', country_id: 'fr', description: '', description_abbreviation: '',
        jan: 2, feb: 3, mar: 4, apr: 4, may: 3, jun: 4, jul: 5, aug: 5, sep: 4, oct: 3, nov: 2, dec: 1,
        jan_reason: 'jan_reason', feb_reason: 'feb_reason', mar_reason: 'mar_reason', apr_reason: 'apr_reason',
        may_reason: 'may_reason', jun_reason: 'jun_reason', jul_reason: 'jul_reason', aug_reason: 'aug_reason',
        sep_reason: 'sep_reason', oct_reason: 'oct_reason', nov_reason: 'nov_reason', dec_reason: 'dec_reason'
      },
      { id: 's2', country_id: 'de', description: '', description_abbreviation: '',
        jan: 2, feb: 3, mar: 4, apr: 4, may: 3, jun: 4, jul: 5, aug: 5, sep: 4, oct: 3, nov: 2, dec: 1,
        jan_reason: 'jan_reason', feb_reason: 'feb_reason', mar_reason: 'mar_reason', apr_reason: 'apr_reason',
        may_reason: 'may_reason', jun_reason: 'jun_reason', jul_reason: 'jul_reason', aug_reason: 'aug_reason',
        sep_reason: 'sep_reason', oct_reason: 'oct_reason', nov_reason: 'nov_reason', dec_reason: 'dec_reason'
      },
      { id: 's3', country_id: 'it', description: '', description_abbreviation: '',
        jan: 2, feb: 3, mar: 4, apr: 4, may: 3, jun: 4, jul: 5, aug: 5, sep: 4, oct: 3, nov: 2, dec: 1,
        jan_reason: 'jan_reason', feb_reason: 'feb_reason', mar_reason: 'mar_reason', apr_reason: 'apr_reason',
        may_reason: 'may_reason', jun_reason: 'jun_reason', jul_reason: 'jul_reason', aug_reason: 'aug_reason',
        sep_reason: 'sep_reason', oct_reason: 'oct_reason', nov_reason: 'nov_reason', dec_reason: 'dec_reason'
      }
    ];
    return of(mock).pipe(delay(this.d));
  }

  // getUserTrips() { return of({}).pipe(delay(2000)); };
  // getTrip(id: string) { return of({}).pipe(delay(2000)); } //this.http.get<ITrip>(`${this.baseUrl}/trips/${id}`); }
  // getPlaces(tripId: string) { return of({}).pipe(delay(2000)); } //this.http.get<IPlace[]>(`${this.baseUrl}/places?trip_id=${tripId}`); }
  // getPlan(id: string) { return of({}).pipe(delay(2000)); } //this.http.get<IPlan>(`${this.baseUrl}/plans/${id}`); }
  // getVisits(planId: string) { return of({}).pipe(delay(2000)); } //return this.http.get<IVisit[]>(`${this.baseUrl}/visits?plan_id=${planId}`); }
  // getCountries() { return of({}).pipe(delay(2000)); } //this.http.get<ICountry[]>(`${this.baseUrl}/countries`); }
  // getSeasons() { return of({}).pipe(delay(2000)); } //this.http.get<ISeason[]>(`${this.baseUrl}/seasons`); }

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
