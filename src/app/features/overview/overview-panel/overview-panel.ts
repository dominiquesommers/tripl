import {Component, computed, inject, ViewChild, TemplateRef, Input, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar } from '../../../components/tab-bar/tab-bar';
import { Itinerary } from '../components/itinerary/itinerary';
import { CostOverview } from '../components/cost-overview/cost-overview';
import { Seasonality } from '../components/seasonality/seasonality';
import { Warnings } from '../components/warnings/warnings';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';
import {AuthService} from '../../../services/auth';
import { TripService } from '../../../services/trip';
import {TabConfig} from '../../../components/tab-bar/tab-bar';
import { SeasonalityService } from '../../../services/seasonality';
import { CostService } from '../../../services/cost';
import { WarningSeverity, WarningsService } from '../../../services/warnings';
import { Cost } from '../../../components/ui2/cost/cost';


@Component({
  selector: 'app-warnings-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="warnings-badge">
      @if (errorCount > 0) {
        <div class="badge-item">
          <span class="count">{{ errorCount }}</span>
          <span class="dot error" [title]="errorCount + ' errors'"></span>
        </div>
      }
      @if (warnCount > 0) {
        <div class="badge-item">
          <span class="count">{{ warnCount }}</span>
          <span class="dot warn" [title]="warnCount + ' warnings'"></span>
        </div>
      }
      @if (infoCount > 0) {
        <div class="badge-item">
          <span class="count">{{ infoCount }}</span>
          <span class="dot info" [title]="infoCount + ' info'"></span>
        </div>
      }
      @if (errorCount === 0 && warnCount === 0 && infoCount === 0) {
        <span class="check">✓</span>
      }
    </div>
  `,
  styles: [`
    .warnings-badge {
      display: inline-flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      line-height: 1;
    }
    .badge-item {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 3px;
      font-size: 11px;
      font-weight: 600;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .dot.error { background-color: rgb(239, 68, 68); }
    .dot.warn  { background-color: rgb(245, 158, 11); }
    .dot.info  { background-color: rgb(96, 165, 250); }
    .check     { color: #22c55e; font-weight: bold; }
  `]
})
export class WarningsBadge {
  @Input() errorCount = 0;
  @Input() warnCount = 0;
  @Input() infoCount = 0;
}


@Component({
  selector: 'app-overview-panel',
  standalone: true,
  imports: [
    CommonModule,
    TabBar,
    Itinerary,
    Cost,
    CostOverview,
    Seasonality,
    Warnings,
    WarningsBadge
  ],
  templateUrl: './overview-panel.html',
  styleUrl: './overview-panel.css'
})
export class OverviewPanel {
  @ViewChild('costTabBadge', { static: true }) costTabBadge!: TemplateRef<unknown>;
  @ViewChild('warningsTabBadge', { static: true }) warningsTabBadge!: TemplateRef<unknown>;

  uiService = inject(UiService);
  authService = inject(AuthService);
  tripService = inject(TripService);
  seasonalityService = inject(SeasonalityService);
  costService = inject(CostService);
  warningsService = inject(WarningsService);

  isPeek = computed(() => this.uiService.isMobile() && this.uiService.sheetState() === 'peek');

  readonly warningsCounts = computed(() => {
    const warnings = this.warningsService.warnings();
    return {
      error: warnings.filter(x => x.severity === 'error').length,
      warn:  warnings.filter(x => x.severity === 'warn').length,
      info:  warnings.filter(x => x.severity === 'info').length,
    };
  });

  readonly overviewTabs = computed<TabConfig[]>(() => {
    const tabs: TabConfig[] = [
      {
        id: 'itinerary',
        label: 'Itinerary',
        icon: 'route',
        getValue: () => this.tripService.plan()?.itinerary().length ?? 0
      },
      {
        id: 'seasonality',
        label: 'Seasonality',
        icon: 'cloud-sun',
        getValue: () => (this.seasonalityService.rows().length === 0) ? '' : (this.seasonalityService.totalScore()*10).toFixed(1)
      }
    ];

    if (!this.authService.isPublicMode()) {
      tabs.push(
        {
          id: 'cost',
          label: 'Cost',
          icon: 'wallet',
          template: this.costTabBadge
        },
        {
          id: 'warnings',
          label: 'Warnings',
          icon: 'triangle-alert',
          template: this.warningsTabBadge
        }
      );
    }
    return tabs;
  });
}
