import {Component, inject, signal, input, effect, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar, TabConfig } from '../../../components/tab-bar/tab-bar';
import { Bookings } from '../components/bookings/bookings';
import { Activities } from '../components/activities/activities';
import { Notes } from '../components/notes/notes';
import { Country } from '../components/country/country';
import {Visit} from '../../../models/visit';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';
import {AuthService} from '../../../services/auth';
import { TripService } from '../../../services/trip';


@Component({
  selector: 'app-place-panel',
  standalone: true,
  imports: [CommonModule, TabBar, Bookings, Activities, Notes, Country],
  templateUrl: './place-panel.html',
  styleUrl: './place-panel.css'
})
export class PlacePanel {
  visit = input.required<Visit>();
  tripService = inject(TripService);
  uiService = inject(UiService);
  authService = inject(AuthService);

  readonly placeTabs = computed<TabConfig[]>(() => {
    let baseTabs: TabConfig[] = [
      {
        id: 'activities',
        label: 'Activities',
        icon: 'map-pin',
        getValue: () => this.visit().place.activities().length
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: 'sticky-note',
        getValue: () => this.visit().place.notes().length
      },
      {
        id: 'country',
        label: 'Country',
        icon: 'globe',
        getValue: () => this.visit().place.country.notes().length
      }
    ];

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
