import {Component, computed, effect, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar } from '../../../components/tab-bar/tab-bar';
import { Itinerary } from '../components/itinerary/itinerary';
import { Cost } from '../components/cost/cost';
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


@Component({
  selector: 'app-overview-panel',
  standalone: true,
  imports: [
    CommonModule,
    TabBar,
    Itinerary,
    Cost,
    Seasonality,
    Warnings
  ],
  templateUrl: './overview-panel.html',
  styleUrl: './overview-panel.css'
})
export class OverviewPanel {
  uiService = inject(UiService);
  authService = inject(AuthService);
  tripService = inject(TripService);
  seasonalityService = inject(SeasonalityService);
  costService = inject(CostService);
  warningsService = inject(WarningsService);

  isPeek = computed(() => this.uiService.isMobile() && this.uiService.sheetState() === 'peek');

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
          getValue: () => {
            const totals = this.costService.total();
            const format = (v: number) => (v / 1000).toFixed(1);

            const diff = totals.improvedEstimate.total - totals.estimated.total;
            const sign = diff >= 0 ? '+' : '';

            // return `${format(totals.actual.total)}k/${format(totals.estimated.total)}k (${sign}${format(diff)}k)`;
            return `${format(totals.actual.total)}k\n~${format(totals.estimated.total)}k\n(${sign}${format(diff)}k)`;
          }
        },
        {
          id: 'warnings',
          label: 'Warnings',
          icon: 'triangle-alert',
          getValue: () => {
            const w = this.warningsService.warnings();
            const getCount = (s: WarningSeverity) => w.filter(x => x.severity === s).length;

            // Create an array of only the parts that exist
            const parts = [
              { count: getCount('error'), label: 'e' },
              { count: getCount('warn'),  label: 'w' },
              { count: getCount('info'),  label: 'i' }
            ]
            .filter(p => p.count > 0) // Remove zeros
            .map(p => `${p.count}${p.label}`); // Format as "3e", "2w", etc.

            // Join them with the pipe separator
            return (parts.length > 0) ? parts.join('\n') : '✓';
          }
        }
      );
    }
    return tabs;
  });
}
