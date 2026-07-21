import {Component, inject, signal, input, effect, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar, TabConfig } from '../../../components/tab-bar/tab-bar';
import {Route} from '../../../models/route';
import {Bookings} from '../components/bookings/bookings';
import {Notes} from '../components/notes/notes';
import {Country} from '../../place-details/components/country/country';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';
import {AuthService} from '../../../services/auth';


@Component({
  selector: 'app-route-panel',
  standalone: true,
  imports: [CommonModule, TabBar, Bookings, Notes, Country],
  templateUrl: './route-panel.html',
  styleUrl: './route-panel.css'
})
export class RoutePanel {
  route = input.required<Route>();
  uiService = inject(UiService);
  authService = inject(AuthService);

  isPeek = computed(() => this.uiService.isMobile() && this.uiService.sheetState() === 'peek');

  readonly routeTabs = computed<TabConfig[]>(() => {
    const route = this.route();

    let baseTabs: TabConfig[] = [
      {
        id: 'notes',
        label: 'Notes',
        icon: 'sticky-note',
        getValue: () => route.notes().length
      }
    ];

    if (!route.isCrossCountry()) {
      baseTabs.push(
        {
          id: 'country',
          label: 'Country',
          icon: 'globe',
          getValue: () => route.source.country.notes().length
        }
      );
    }

    if (!this.authService.isPublicMode()) {
      baseTabs = [
        {
          id: 'bookings',
          label: 'Bookings',
          icon: 'ticket'
        },
        ...baseTabs
      ];
    }

    return baseTabs;
  });
}
