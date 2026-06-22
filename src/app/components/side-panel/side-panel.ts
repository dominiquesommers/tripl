import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiService } from '../../services/ui';
import { TripService } from '../../services/trip';
import { OverviewPanel } from '../../features/overview/overview-panel/overview-panel';
import { PlacePanel } from '../../features/place-details/place-panel/place-panel';
import { RoutePanel } from '../../features/route-details/route-panel/route-panel';

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
  // Inject services
  public uiService = inject(UiService);
  public tripService = inject(TripService);

  @ViewChild('sheet') private sheet?: ElementRef<HTMLElement>;

  // For the mobile bottom sheet state logic
  // sheetState: 'open' | 'peek' | 'closed' = 'peek';
  sheetState: 'open' | 'peek' = 'peek';
  isDragging = false;

  private readonly peekHeight = 72;
  private dragStartY = 0;
  private dragStartOffset = 0;
  private dragStartTime = 0;
  private currentOffset = 0;
  private activePointerId: number | null = null;

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

  ngAfterViewInit() {
    queueMicrotask(() => this.snapToState(this.sheetState));
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.snapToState(this.sheetState);
  }

  // Mobile sheet toggle logic
  toggleMobileSheet() {
    this.sheetState = this.sheetState === 'open' ? 'peek' : 'open';
    this.syncMobileOpenState(this.sheetState === 'open');
    this.snapToState(this.sheetState);
  }

  onGrabberPointerDown(event: PointerEvent) {
    if (!this.uiService.isMobile()) return;

    this.activePointerId = event.pointerId;
    this.isDragging = true;
    this.dragStartY = event.clientY;
    this.dragStartOffset = this.currentOffset;
    this.dragStartTime = performance.now();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onGrabberPointerMove(event: PointerEvent) {
    if (!this.isDragging || event.pointerId !== this.activePointerId) return;

    const deltaY = event.clientY - this.dragStartY;
    this.setSheetOffset(this.dragStartOffset + deltaY);
    event.preventDefault();
  }

  onGrabberPointerUp(event: PointerEvent) {
    if (!this.isDragging || event.pointerId !== this.activePointerId) return;

    const dragged = this.currentOffset - this.dragStartOffset;
    const elapsed = Math.max(performance.now() - this.dragStartTime, 1);
    const velocity = dragged / elapsed;
    const maxOffset = this.maxSheetOffset();
    const tap = Math.abs(event.clientY - this.dragStartY) < 8;

    this.isDragging = false;
    this.activePointerId = null;

    if (tap) {
      this.toggleMobileSheet();
      return;
    }

    const shouldOpen = velocity < -0.45 || (velocity <= 0.45 && this.currentOffset < maxOffset * 0.55);
    this.sheetState = shouldOpen ? 'open' : 'peek';
    this.syncMobileOpenState(shouldOpen);
    this.snapToState(this.sheetState);
  }

  private syncMobileOpenState(isOpen: boolean) {
    this.uiService.isSidebarOpen.set(isOpen);
    if (isOpen) {
      this.uiService.isSearchExpanded.set(false);
    }
  }

  private snapToState(state: 'open' | 'peek') {
    const offset = state === 'open' ? 0 : this.maxSheetOffset();
    this.setSheetOffset(offset);
  }

  private setSheetOffset(offset: number) {
    const clampedOffset = Math.max(0, Math.min(offset, this.maxSheetOffset()));
    this.currentOffset = clampedOffset;
    this.sheet?.nativeElement.style.setProperty('--sheet-offset', `${clampedOffset}px`);
  }

  private maxSheetOffset() {
    const sheetHeight = this.sheet?.nativeElement.getBoundingClientRect().height ?? 0;
    return Math.max(sheetHeight - this.peekHeight, 0);
  }
}
