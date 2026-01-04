import {Injectable, inject, signal, WritableSignal, computed} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {TripService} from './trip';

@Injectable({ providedIn: 'root' })
export class UiService {
  private breakpointObserver = inject(BreakpointObserver);
  private tripService = inject(TripService);
  readonly fallbackSignal = signal('');

  readonly isSidebarOpen: WritableSignal<boolean> = signal(true);
  readonly isLoading: WritableSignal<boolean> = signal(false);
  readonly isSearchExpanded: WritableSignal<boolean> = signal(false);

  readonly sidePanelWidth = computed(() => (this.isMobile() || !this.tripService.plan() || !this.isSidebarOpen()) ? 0 : 445);

  readonly isMobile = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  toggleSearch() {
    this.isSearchExpanded.update(v => !v);
  }

  closeSearch() {
    this.isSearchExpanded.set(false);
  }

  setLoading(state: boolean) {
    this.isLoading.set(state);
  }
}
