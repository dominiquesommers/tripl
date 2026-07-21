import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiService } from '../../services/ui';
import { TripService } from '../../services/trip';
import { OverviewPanel } from '../../features/overview/overview-panel/overview-panel';
import { PlacePanel } from '../../features/place-details/place-panel/place-panel';
import { RoutePanel } from '../../features/route-details/route-panel/route-panel';

type SheetState = 'peek' | 'half' | 'full';

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [
    CommonModule,
    OverviewPanel,
    PlacePanel,
    RoutePanel
  ],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.css'
})
export class SidePanel implements AfterViewInit {
  public uiService = inject(UiService);
  public tripService = inject(TripService);

  @ViewChild('sheet') private sheet?: ElementRef<HTMLElement>;

  // sheetState: SheetState = 'peek';
  isDragging = false;

  // --- Tunable geometry ---
  private readonly peekHeightPx = 74;        // grabber + tab bar
  private readonly headerClearancePx = 70;   // global page header the sheet clears when fully open
  private readonly sidePaddingPercent = 2.5; // 95% width bubble in peek/half
  private readonly bottomPaddingPx = 12;

  private dragStartY = 0;
  private dragStartProgress = 0;
  private dragStartTime = 0;
  private currentProgress = 0;
  private activePointerId: number | null = null;

  private headerPointerId: number | null = null;
  private headerStartX = 0;

  // --- new fields, alongside the existing drag fields ---
  private contentPointerId: number | null = null;
  private contentStartX = 0;
  private contentStartY = 0;
  private contentStartTime = 0;
  private contentDragActive = false;

  headerTitle = computed(() => {
    const selectedVisit = this.uiService.selectedVisit();
    const selectedRoute = this.uiService.selectedRoute();
    if (selectedVisit) {
      return this.uiService.activeTab() === 'country' ? selectedVisit.place.country.name : selectedVisit.place.name();
    } else if (selectedRoute) {
      return `${selectedRoute.source.name()} → ${selectedRoute.target.name()}`;
    } else {
      return 'Your Itinerary';
    }
  });

  constructor() {
    // Re-snap whenever we cross the mobile/desktop breakpoint
    effect(() => {
      if (this.uiService.isMobile()) {
        queueMicrotask(() => this.snapToState(this.uiService.sheetState()));
      }
    });

    effect(() => {
      const state = this.uiService.sheetState();
      if (this.uiService.isMobile()) {
        queueMicrotask(() => this.snapToState(state));
      }
    });
  }

  ngAfterViewInit() {
    queueMicrotask(() => this.snapToState(this.uiService.sheetState()));
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.isDragging) return;
    this.snapToState(this.uiService.sheetState());
  }

  // ---------- Grabber: peek / half / full drag ----------

  onGrabberPointerDown(event: PointerEvent) {
    if (!this.uiService.isMobile()) return;

    this.activePointerId = event.pointerId;
    this.isDragging = true;
    this.dragStartY = event.clientY;
    this.dragStartProgress = this.currentProgress;
    this.dragStartTime = performance.now();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onGrabberPointerMove(event: PointerEvent) {
    if (!this.isDragging || event.pointerId !== this.activePointerId) return;

    const { peekH, fullH } = this.getMetrics();
    const span = Math.max(fullH - peekH, 1);
    const deltaY = event.clientY - this.dragStartY;
    this.applyProgress(this.dragStartProgress - deltaY / span);
    event.preventDefault();
  }

  onGrabberPointerUp(event: PointerEvent) {
    if (!this.isDragging || event.pointerId !== this.activePointerId) return;

    const draggedY = event.clientY - this.dragStartY;
    const elapsed = Math.max(performance.now() - this.dragStartTime, 1);
    const velocity = draggedY / elapsed; // px/ms, negative = moving up (opening)
    const tap = Math.abs(draggedY) < 8;

    this.isDragging = false;
    this.activePointerId = null;

    if (tap) {
      this.cycleSheetState();
      return;
    }

    const fastUp = velocity < -0.5;
    const fastDown = velocity > 0.5;

    let target: SheetState;
    if (fastUp) {
      target = this.currentProgress < 0.25 ? 'half' : 'full';
    } else if (fastDown) {
      target = this.currentProgress > 0.75 ? 'half' : 'peek';
    } else if (this.currentProgress < 0.25) {
      target = 'peek';
    } else if (this.currentProgress < 0.75) {
      target = 'half';
    } else {
      target = 'full';
    }

    this.setSheetState(target);
  }

  private cycleSheetState() {
    const next: Record<SheetState, SheetState> = { peek: 'half', half: 'full', full: 'peek' };
    this.setSheetState(next[this.uiService.sheetState()]);
  }

  private setSheetState(state: SheetState) {
    this.uiService.sheetState.set(state);
    this.syncMobileOpenState(state !== 'peek');
    this.snapToState(state);
  }

  private syncMobileOpenState(isOpen: boolean) {
    this.uiService.isSidebarOpen.set(isOpen);
    if (isOpen) {
      this.uiService.isSearchExpanded.set(false);
    }
  }

  private snapToState(state: SheetState) {
    const progress = state === 'peek' ? 0 : state === 'half' ? 0.5 : 1;
    this.applyProgress(progress);
  }

  private getMetrics() {
    const vh = window.innerHeight;
    const peekH = this.peekHeightPx;
    const fullH = Math.max(vh - this.headerClearancePx, peekH + 40);
    const halfH = Math.min(Math.max(vh * 0.5, peekH + 40), fullH);
    return { peekH, halfH, fullH };
  }

  /** Drives the whole morph: 0 = peek, 0.5 = half, 1 = full. */
  private applyProgress(p: number) {
    p = Math.max(0, Math.min(1, p));
    const { peekH, halfH, fullH } = this.getMetrics();

    const height = p <= 0.5
      ? this.lerp(peekH, halfH, p / 0.5)
      : this.lerp(halfH, fullH, (p - 0.5) / 0.5);

    // Bubble shape (peek/half) holds steady; only half->full morphs into a full sheet
    const t2 = p <= 0.5 ? 0 : (p - 0.5) / 0.5;
    const inset = p <= 0.5 ? this.sidePaddingPercent : this.lerp(this.sidePaddingPercent, 0, t2);
    const bottom = p <= 0.5 ? this.bottomPaddingPx : this.lerp(this.bottomPaddingPx, 0, t2);
    const bubbleRadius = this.peekHeightPx / 2; // fixed pill radius, same in peek & half
    const radiusTop = p <= 0.5 ? bubbleRadius : this.lerp(bubbleRadius, 24, t2);
    const radiusBottom = p <= 0.5 ? bubbleRadius : this.lerp(bubbleRadius, 0, t2);
    // const radiusTop = p <= 0.5 ? 999 : this.lerp(999, 24, t2);
    // const radiusBottom = p <= 0.5 ? 999 : this.lerp(999, 0, t2);

    const el = this.sheet?.nativeElement;
    if (el) {
      this.uiService.currentSheetHeight.set(height);
      el.style.setProperty('--sheet-height', `${height}px`);
      el.style.setProperty('--sheet-inset', `${inset}%`);
      el.style.setProperty('--sheet-bottom', `${bottom}px`);
      el.style.setProperty('--sheet-radius-top', `${radiusTop}px`);
      el.style.setProperty('--sheet-radius-bottom', `${radiusBottom}px`);
    }

    this.currentProgress = p;
  }

  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  // ---------- Header: swipe between visits/routes ----------

  onHeaderPointerDown(event: PointerEvent) {
    if (!this.uiService.isMobile()) return;
    this.headerPointerId = event.pointerId;
    this.headerStartX = event.clientX;
  }

  onHeaderPointerMove(event: PointerEvent) {
    // Reserved for live drag feedback (e.g. sliding the title). Currently we act on release only.
  }

  onHeaderPointerUp(event: PointerEvent) {
    if (this.headerPointerId === null || event.pointerId !== this.headerPointerId) return;
    const deltaX = event.clientX - this.headerStartX;
    this.headerPointerId = null;

    const threshold = 40;
    if (deltaX <= -threshold) {
      this.stepItinerary(1);
    } else if (deltaX >= threshold) {
      this.stepItinerary(-1);
    }
  }

  private buildItinerarySequence(): Array<
    | { type: 'visit'; visit: any }
    | { type: 'route'; route: any }
  > {
    const plan = this.tripService.plan();
    if (!plan) return [];

    const visits = plan.itinerary();
    const traverses = plan.itineraryTraverses();
    const sequence: Array<{ type: 'visit'; visit: any } | { type: 'route'; route: any }> = [];

    for (let i = 0; i < visits.length; i++) {
      sequence.push({ type: 'visit', visit: visits[i] });
      const traverse = traverses[i];
      if (traverse) {
        sequence.push({ type: 'route', route: traverse.route });
      }
    }
    return sequence;
  }

  private stepItinerary(offset: number) {
    const sequence = this.buildItinerarySequence();
    if (sequence.length === 0) return;

    const selectedVisit = this.uiService.selectedVisit();
    const selectedRoute = this.uiService.selectedRoute();

    const currentIndex = sequence.findIndex(entry =>
      (entry.type === 'visit' && entry.visit === selectedVisit) ||
      (entry.type === 'route' && entry.route === selectedRoute)
    );

    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + offset + sequence.length) % sequence.length;

    const next = sequence[nextIndex];
    if (next.type === 'visit') {
      // this.uiService.selectedVisit.set(next.visit);
      // this.uiService.selectedRoute.set(null);
    } else {
      // this.uiService.selectedRoute.set(next.route);
      // this.uiService.selectedVisit.set(null);
    }
  }

  // ---------- Peek-mode content area: drag-to-open, tap-through to tabs ----------

  onContentPointerDown(event: PointerEvent) {
    if (!this.uiService.isMobile() || this.uiService.sheetState() !== 'peek') return;
    this.contentPointerId = event.pointerId;
    this.contentStartX = event.clientX;
    this.contentStartY = event.clientY;
    this.contentStartTime = performance.now();
    this.contentDragActive = false;
    // deliberately no preventDefault / setPointerCapture here — a plain tap
    // must be free to reach the tab button underneath untouched
  }

  onContentPointerMove(event: PointerEvent) {
    if (this.contentPointerId === null || event.pointerId !== this.contentPointerId) return;

    const dx = event.clientX - this.contentStartX;
    const dy = event.clientY - this.contentStartY;

    if (!this.contentDragActive) {
      // stay hands-off until movement is clearly a vertical drag —
      // anything smaller/sideways is left alone as a normal tap
      if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(dx)) return;
      this.contentDragActive = true;
      this.isDragging = true;
      this.dragStartProgress = this.currentProgress;
    }

    const { peekH, fullH } = this.getMetrics();
    const span = Math.max(fullH - peekH, 1);
    this.applyProgress(this.dragStartProgress - dy / span);
    event.preventDefault();
  }

  onContentPointerUp(event: PointerEvent) {
    if (this.contentPointerId === null || event.pointerId !== this.contentPointerId) return;
    this.contentPointerId = null;

    if (!this.contentDragActive) return; // pure tap — the tab's own click handles itself

    this.contentDragActive = false;
    this.isDragging = false;

    const elapsed = Math.max(performance.now() - this.contentStartTime, 1);
    const velocity = (event.clientY - this.contentStartY) / elapsed;
    const target: SheetState = velocity < -0.5 || this.currentProgress > 0.3 ? 'half' : 'peek';
    this.setSheetState(target);
  }
}