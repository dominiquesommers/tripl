import {inject, Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RouteGeometry {
  geometry: any;       // This will hold the GeoJSON object
  distance: number;    // km
  duration: number;    // minutes
}

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private http = inject(HttpClient);

  getDirections(source: [number, number], target: [number, number], mode: string): Observable<RouteGeometry> {
    const profile = mode === 'driving' ? 'driving' : 'driving';

    // Note: Mapbox expects [longitude, latitude]
    const coordinates = `${source[1]},${source[0]};${target[1]},${target[0]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?access_token=${environment.mapboxToken}&geometries=polyline6&overview=full`;

    return this.http.get<any>(url).pipe(
      map(response => {
        const route = response.routes[0];
        return {
          geometry: route.geometry, // This will be the encoded string
          distance: Math.round(route.distance / 1000), // convert meters to km
          duration: Math.round(route.duration / 60)    // convert seconds to minutes
        };
      })
    );
  }
}
