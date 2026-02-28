import {Component, effect, inject, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar } from '../../../components/tab-bar/tab-bar';
import { Itinerary } from '../components/itinerary/itinerary';
import { Cost } from '../components/cost/cost';
import { Seasonality } from '../components/seasonality/seasonality';
import { Warnings } from '../components/warnings/warnings';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';

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
  overviewTabs = ['itinerary', 'seasonality', 'cost', 'warnings'];
}
