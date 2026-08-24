import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, map} from 'rxjs';
import {environment} from '../../environments/environment';
import {RouteType} from '../models/route';

export interface RouteGeometry {
  geometry: [number, number][]; // This will hold the GeoJSON object
  distance: number;             // km
  duration: number;             // minutes
}

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private http = inject(HttpClient);

  getDirections(source: [number, number], target: [number, number], mode: string): Observable<RouteGeometry> {
    const profileMap: Partial<Record<any, string>> = {
      walking: 'walking',
      cycling: 'cycling',
    };
    const profile = profileMap[mode] ?? 'driving';
    const coordinates = `${source[1]},${source[0]};${target[1]},${target[0]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${environment.mapboxToken}&geometries=geojson&overview=full`;

    return this.http.get<any>(url).pipe(
      map(response => {
        const route = response.routes[0];
        return {
          geometry: route.geometry.coordinates as [number, number][],
          distance: Math.round(route.distance / 1000),  // km
          duration: Math.round(route.duration / 3600)   // hours
        };
      })
    );
  }
}
