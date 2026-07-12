import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TripService } from '../../../../services/trip';
import { WarningsService, WarningSeverity } from '../../../../services/warnings';


@Component({
  selector: 'app-warnings',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './warnings.html',
  styleUrls: ['./warnings.css'],
})
export class Warnings {

  tripService = inject(TripService);
  warningsService = inject(WarningsService);

  severityColor(severity: WarningSeverity): string {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warn':  return '#f59e0b';
      case 'info':  return '#60a5fa';
    }
  }
}
