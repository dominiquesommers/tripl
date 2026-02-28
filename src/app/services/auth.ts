import {computed, inject, Injectable, PLATFORM_ID, signal} from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { environment } from '../../environments/environment';
import {isPlatformBrowser} from '@angular/common';

export const MOCK_USER = {
  uid: 'offline-dev-id',
  displayName: 'Dev user',
  photoURL: null,
  email: 'dev@dev.local'
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private auth;

  private _user = signal<any | null>(null);
  readonly user = computed(() => this.isOfflineMode() ? MOCK_USER : this._user());
  private firebaseListenerStarted = false;
  // readonly isOfflineMode = signal<boolean>(environment.useOfflineMode || !navigator.onLine);
  readonly isOfflineMode = signal<boolean>(
  environment.useOfflineMode ||
  (isPlatformBrowser(this.platformId) ? !navigator.onLine : false)
);

  constructor() {
    const app = initializeApp(environment.firebase);
    this.auth = getAuth(app);
    console.log('useOfflineMode', environment.useOfflineMode);
    if (!environment.useOfflineMode) {
      this.initFirebaseAuthListener();
    }
    this.setupDevToggles();
  }

  private initFirebaseAuthListener() {
    if (this.firebaseListenerStarted) return;
    this.firebaseListenerStarted = true;

    onAuthStateChanged(this.auth, (user) => {
      if (user && user.photoURL) {
        const cleanUrl = user.photoURL.replace('=s96-c', '=s128-c');
        Object.defineProperty(user, 'photoURL', { value: cleanUrl, writable: true });
      }
      this._user.set(user);
    });
  }

  private setupDevToggles() {
    if (isPlatformBrowser(this.platformId) && !environment.production) {
      (window as any).toggleOffline = () => {
        const newState = !this.isOfflineMode();
        if (!newState) this.initFirebaseAuthListener();
        this.isOfflineMode.set(newState);
        console.log(`%c Offline Mode: ${newState ? 'ON' : 'OFF'} `, 'background: #222; color: #bada55');
      };
    }
  }

  async login() {
    if (this.isOfflineMode()) {
      console.warn("Currently in offline mode. Login bypassed.");
      return;
    }
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async logout() {
    return signOut(this.auth);
  }
}
