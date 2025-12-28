import {Injectable, inject, signal, WritableSignal} from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiService {
  private breakpointObserver = inject(BreakpointObserver);

  readonly isSidebarOpen: WritableSignal<boolean> = signal(true);
  readonly isLoading: WritableSignal<boolean> = signal(false);

  readonly isMobile = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  toggleSidebar() {
    this.isSidebarOpen.update(open => !open);
  }

  setLoading(state: boolean) {
    this.isLoading.set(state);
  }
}
