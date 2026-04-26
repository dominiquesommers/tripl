import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';
import {getAuth} from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  /**
   * GET: Retrieve data from the server
   * @param path e.g., 'places' or 'trips'
   */
  get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${path}`);
  }

  /**
   * POST: Create a new resource
   * @param path e.g., 'places'
   * @param body The data to send
   */
  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${path}`, body);
  }

  /**
   * PUT: Update an existing resource (replaces the whole object)
   * @param path e.g., 'places/123'
   * @param body The updated data
   */
  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${path}`, body);
  }

  /**
   * PATCH: Partially update a resource
   */
  patch<T>(path: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${path}`, body);
  }

  /**
   * DELETE: Remove a resource
   * @param path e.g., 'places/123'
   */
  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${path}`);
  }

  async fireAndForget(path: string, body: any) {
    const url = `${this.baseUrl}/${path}`;
    const token = await this.authService.getToken();

    fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(body),
      keepalive: true
    });
  }

  // fireAndForget(path: string, body: any): void {
  //   const url = `${this.baseUrl}/${path}`;
  //
  //   fetch(url, {
  //     method: 'PATCH',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify(body),
  //     keepalive: true
  //   }).catch(err => {
  //     // Silent fail, as we can't provide UI feedback during unload anyway
  //     console.warn('Fire-and-forget persist failed:', err);
  //   });
  // }
}
