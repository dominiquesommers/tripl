import {Component, inject, signal, input, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar } from '../../../components/tab-bar/tab-bar';
import {Route} from '../../../models/route';
import {Bookings} from '../components/bookings/bookings';
import {Notes} from '../components/notes/notes';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';


@Component({
  selector: 'app-route-panel',
  standalone: true,
  imports: [CommonModule, TabBar, Bookings, Notes],
  templateUrl: './route-panel.html',
  styleUrl: './route-panel.css'
})
export class RoutePanel {
  route = input.required<Route>();

  uiService = inject(UiService);
  routeTabs = ['bookings', 'notes'];
}
