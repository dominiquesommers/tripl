import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { ApiService } from './api';
import { NavigationService } from './navigation';

export const MOCK_USER = {
  uid: 'offline-dev-id',
  displayName: 'Dev user',
  photoURL: 'https://ui-avatars.com/api/?name=Dev+User&background=0D8ABC&color=fff',
  email: 'dev@dev.local'
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiService = inject(ApiService);
  private navigationService = inject(NavigationService);

  private platformId = inject(PLATFORM_ID);
  private auth;

  // 1. Core State Signals
  private _user = signal<User | any | null>(null);
  readonly isOnline = signal<boolean>(
    isPlatformBrowser(this.platformId) ? navigator.onLine : true
  );
  readonly isDevMode = signal<boolean>(environment.useOfflineMode);

  // 2. Derived State Signals
  readonly user = computed(() => {
    return this.isDevMode() ? MOCK_USER : this._user();
  });

  readonly canEdit = signal<boolean>(false);

  readonly isPublicMode = computed(() => {
    if (this.isDevMode()) return false;
    if (!this._user()) return true;
    return !this.canEdit();
  });


  private firebaseListenerStarted = false;

  constructor() {
    const app = initializeApp(environment.firebase);
    this.auth = getAuth(app);

    if (isPlatformBrowser(this.platformId)) {
      // Monitor actual hardware connection
      window.addEventListener('online', () => this.isOnline.set(true));
      window.addEventListener('offline', () => this.isOnline.set(false));

      // Only listen to Firebase if we aren't forcing Dev Mode
      if (!this.isDevMode()) {
        this.initFirebaseAuthListener();
      }

      this.setupDevToggles();
    }
  }

  private initFirebaseAuthListener() {
    if (this.firebaseListenerStarted) return;
    this.firebaseListenerStarted = true;

    onAuthStateChanged(this.auth, async (user) => {
      if (user && user.photoURL) {
        const cleanUrl = user.photoURL.replace('=s96-c', '=s128-c');
        (user as any).photoURL = cleanUrl;
      }
      this._user.set(user);

      // if (user) {
      //   const tripId = this.navigationService.tripId() ?? '';
      //   this.apiService.get<{ canEdit: boolean }>(`auth/${tripId}/permissions`)
      //     .subscribe({
      //       next: (result) => this.canEdit.set(result.canEdit),
      //       error: (err) => {
      //         console.error("Permissions fetch failed", err);
      //         this.canEdit.set(false);
      //       }
      //     });
      //   // const token = await user.getIdToken();
      //   // this.http.get<{ canEdit: boolean }>(`${environment.apiUrl}/auth/permissions`, {
      //   //   headers: { Authorization: `Bearer ${token}` }
      //   // }).subscribe(result => {
      //   //   this.canEdit.set(result.canEdit);
      //   // });
      // } else {
      //   this.canEdit.set(false);
      // }
    });
  }

  private permissionEffect = effect(() => {
    const user = this.user();
    const tripId = this.navigationService.tripId();
    const isDev = this.isDevMode();

    if (isDev) {
      // If Dev Mode, assume edit access
      this.canEdit.set(true);
      return;
    }

    if (!user || !tripId) {
      this.canEdit.set(false);
      return;
    }

    this.apiService.get<{ canEdit: boolean }>(`auth/${tripId}/permissions`)
      .subscribe({
        next: (res) => this.canEdit.set(res.canEdit),
        error: () => this.canEdit.set(false)
      });
  });

  private setupDevToggles() {
    if (!environment.production) {
      (window as any).toggleDevMode = () => {
        this.isDevMode.update(prev => !prev);

        // const newState = !this.isDevMode();
        // this.isDevMode.set(newState);

        // if (!newState) {
        //   this.initFirebaseAuthListener();
        // }

        console.log(
          `%c Dev Mode (Mock Data): ${this.isDevMode() ? 'ON' : 'OFF'} `,
          'background: #222; color: #bada55; font-weight: bold;'
        );
      };
    }
  }

  async login() {
    if (this.isDevMode()) {
      console.warn("Currently in Dev Mode. Login bypassed.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      return await signInWithPopup(this.auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      throw error;
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      this._user.set(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  }

  async getToken(): Promise<string | null> {
    if (this.isDevMode()) {
      return 'mock-dev-token'; // Or handle dev auth differently
    }

    const currentUser = this.auth.currentUser;
    if (!currentUser) return null;

    return await currentUser.getIdToken();
  }
}
