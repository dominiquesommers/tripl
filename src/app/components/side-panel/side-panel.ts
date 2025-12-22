import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { CdkDragEnd } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop'; // Import this!
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { TripService } from '../../services/trip';

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './side-panel.html',
  styleUrls: ['./side-panel.css']
})
export class SidePanel implements OnInit, OnDestroy {
  isMobile = false;
  private destroy$ = new Subject<void>();

  public tripService = inject(TripService);
  sheetState: 'open' | 'peek' = 'peek';

  constructor(
    private breakpointObserver: BreakpointObserver
  ) {}

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
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile = result.matches;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
