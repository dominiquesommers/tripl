import {ApiService} from './api';
import {Injectable} from '@angular/core';
import {catchError, EMPTY, forkJoin, Observable, of, switchMap, tap} from 'rxjs';
import {ICountry} from '../models/country';
import {IUserPlan, TripsDataPackage} from '../models/user';
import {ITrip, TripDataPackage} from '../models/trip';
import {IPlace} from '../models/place';
import {IRoute} from '../models/route';
import {ISeason} from '../models/season';
import {IPlan, PlanDataPackage} from '../models/plan';
import {IVisit} from '../models/visit';
import {ITraverse} from '../models/traverse';
import {IRouteNote} from '../models/route-note';
import {IActivity} from '../models/activity';
import {IPlaceNote} from '../models/place-note';
import {ICountryNote} from '../models/country-note';

@Injectable({ providedIn: 'root' })
export class MockService {
  constructor(private apiService: ApiService) {}

  fetchTripsMockAggregate(): Observable<TripsDataPackage> {
    return forkJoin({
      trips: this.apiService.get<ITrip[]>('trips'),
      plans: this.apiService.get<IUserPlan[]>('plans')
    });
  }

  fetchTripMockAggregate(tripId: string): Observable<TripDataPackage> {
    return forkJoin({
      trip: this.apiService.get<ITrip>(`trips/${tripId}`),
      places: this.apiService.get<IPlace[]>(`places?trip_id=${tripId}`),
      activities: this.apiService.get<IActivity[]>(`activities?trip_id=${tripId}`),
      placeNotes: this.apiService.get<IPlaceNote[]>(`place_notes?trip_id=${tripId}`),
      routes: this.apiService.get<IRoute[]>(`routes?trip_id=${tripId}`),
      routeNotes: this.apiService.get<IRouteNote[]>(`route_notes?trip_id=${tripId}`),
      countries: this.apiService.get<ICountry[]>(`countries`),
      countryNotes: this.apiService.get<ICountryNote[]>(`country_notes?trip_id=${tripId}`),
      seasons: this.apiService.get<ISeason[]>(`seasons`)
    });
  }

  fetchPlanMockAggregate(planId: string): Observable<PlanDataPackage> {
    return forkJoin({
      plan: this.apiService.get<IPlan>(`plans/${planId}`),
      visits: this.apiService.get<IVisit[]>(`visits?plan_id=${planId}`),
      traverses: this.apiService.get<ITraverse[]>(`traverses?plan_id=${planId}`)
    });
  }


  resolveCountryMock(name: string): Observable<ICountry> {
    return this.apiService.get<ICountry[]>(`countries?name=${name}`).pipe(
      switchMap(found => found.length > 0
        ? of(found[0])
        : this.apiService.post<ICountry>('countries', { name })
      )
    );
  }

  cleanupMockOrphans(
    activityIds: string[],
    placeNoteIds: string[],
    routeIds: string[],
    routeNoteIds: string[],
    visitIds: string[],
    traverseIds: string[]
  ): void {
    const deletions: Observable<any>[] = [
      ...activityIds.map(id => this.apiService.delete(`activities/${id}`)),
      ...placeNoteIds.map(id => this.apiService.delete(`place_notes/${id}`)),
      ...routeIds.map(id => this.apiService.delete(`routes/${id}`)),
      ...routeNoteIds.map(id => this.apiService.delete(`route_notes/${id}`)),
      ...visitIds.map(id => this.apiService.delete(`visits/${id}`)),
      ...traverseIds.map(id => this.apiService.delete(`traverses/${id}`))
    ];

    if (deletions.length > 0) {
      forkJoin(deletions).pipe(
        catchError(err => {
          console.warn('Mock cleanup failed (this is usually okay):', err);
          return EMPTY;
        })
      ).subscribe();
    }
  }
}
