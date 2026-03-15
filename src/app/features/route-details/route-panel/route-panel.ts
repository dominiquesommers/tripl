import {Component, inject, signal, input, effect, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar } from '../../../components/tab-bar/tab-bar';
import {Route} from '../../../models/route';
import {Bookings} from '../components/bookings/bookings';
import {Notes} from '../components/notes/notes';
import {Country} from '../../place-details/components/country/country';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';


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
  routeTabs = computed(() => {
    const route = this.route();
    const tabs = ['bookings', 'notes'];
    if (!route.isCrossCountry()) {
      tabs.push('country');
    }
    return tabs;
  });
}
