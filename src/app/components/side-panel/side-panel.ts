import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop'; // Import this!
import { Subject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TripService } from '../../services/trip';
import { UiService } from '../../services/ui';

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './side-panel.html',
  styleUrls: ['./side-panel.css']
})
export class SidePanel implements OnInit, OnDestroy {
  tripService = inject(TripService);
  uiService = inject(UiService);

  private destroy$ = new Subject<void>();

  sheetState: 'open' | 'peek' = 'peek';

  constructor() {}

  onDragEnd(event: CdkDragEnd) {
    const offset = event.distance.y;
    if (offset < -100) {
      this.sheetState = 'open';
    } else if (offset > 100) {
      this.sheetState = 'peek';
    }
    event.source._dragRef.reset();
  }

  toggleMobileSheet() {
    this.sheetState = this.sheetState === 'peek' ? 'open' : 'peek';
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
