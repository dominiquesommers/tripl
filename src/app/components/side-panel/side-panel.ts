import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiService } from '../../services/ui';
import { TripService } from '../../services/trip';
import { OverviewPanel } from '../../features/overview/overview-panel/overview-panel';
import { PlacePanel } from '../../features/place-details/place-panel/place-panel';
import { RoutePanel } from '../../features/route-details/route-panel/route-panel';
import { CdkDrag, CdkDragHandle, CdkDragEnd } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [
    CommonModule,
    OverviewPanel,
    PlacePanel,
    RoutePanel,
    // CdkDrag,
    CdkDragHandle
  ],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.css'
})
export class SidePanel {
  // Inject services
  public uiService = inject(UiService);
  public tripService = inject(TripService);

  // For the mobile bottom sheet state logic
  sheetState: 'open' | 'peek' | 'closed' = 'peek';

  /**
   * Logic to determine the title in the floating header.
   * This updates automatically because it's based on signals.
   */
  getHeaderTitle(): string {
    const selectedVisit = this.uiService.selectedVisit();
    const selectedRoute = this.uiService.selectedRoute();

    if (selectedVisit) {
      return selectedVisit.place.name();
    } else if (selectedRoute) {
      return `${selectedRoute.source.name()} → ${selectedRoute.target.name()}`;
    } else {
      return 'Your Itinerary';
    }
  }

  // Mobile sheet toggle logic
  toggleMobileSheet() {
    this.sheetState = this.sheetState === 'open' ? 'peek' : 'open';
  }

  // Handle CDK Drag end for mobile
  onDragEnd(event: CdkDragEnd) {
    const offset = event.distance.y;
    if (offset < -100) {
      this.sheetState = 'open';
    } else if (offset > 100) {
      this.sheetState = 'peek';
    }
    event.source.reset(); // Reset position so CSS classes take over
  }
}

// import { Component, inject, OnInit, OnDestroy } from '@angular/core';
// import { CdkDragEnd } from '@angular/cdk/drag-drop';
// import { DragDropModule } from '@angular/cdk/drag-drop'; // Import this!
// import { Subject } from 'rxjs';
// import { CommonModule } from '@angular/common';
// import { TripService } from '../../services/trip';
// import { UiService } from '../../services/ui';
//
// @Component({
//   selector: 'app-side-panel',
//   standalone: true,
//   imports: [CommonModule, DragDropModule],
//   templateUrl: './side-panel.html',
//   styleUrls: ['./side-panel.css']
// })
// export class SidePanel implements OnInit, OnDestroy {
//   tripService = inject(TripService);
//   uiService = inject(UiService);
//
//   private destroy$ = new Subject<void>();
//
//   sheetState: 'open' | 'peek' = 'peek';
//
//   constructor() {}
//
//   onDragEnd(event: CdkDragEnd) {
//     const offset = event.distance.y;
//     if (offset < -100) {
//       this.sheetState = 'open';
//     } else if (offset > 100) {
//       this.sheetState = 'peek';
//     }
//     event.source._dragRef.reset();
//   }
//
//   toggleMobileSheet() {
//     this.sheetState = this.sheetState === 'peek' ? 'open' : 'peek';
//   }
//
//   ngOnInit(): void {
//   }
//
//   ngOnDestroy(): void {
//     this.destroy$.next();
//     this.destroy$.complete();
//   }
// }
