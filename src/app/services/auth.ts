import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth;
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor() {
    const firebaseConfig = {
      apiKey: "AIzaSyBKjHTxlaa6D7icnxhp1Unz9uTCcuJLWSc",
      authDomain: "travelmap-b4be9.firebaseapp.com",
      projectId: "travelmap-b4be9",
      storageBucket: "travelmap-b4be9.firebasestorage.app",
      messagingSenderId: "211285565341",
      appId: "1:211285565341:web:beb194890d6cf76ba95974"
    };

    const app = initializeApp(firebaseConfig);
    this.auth = getAuth(app);

    onAuthStateChanged(this.auth, (user) => {
      if (user && user.photoURL) {
        const cleanUrl = user.photoURL.replace('=s96-c', '=s128-c');
        Object.defineProperty(user, 'photoURL', { value: cleanUrl, writable: true });
      }
      this.userSubject.next(user);
    });
  }

  async login() {
    return signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  async logout() {
    return signOut(this.auth);
  }

  getCurrentUserValue() {
    return this.userSubject.value;
  }
}
