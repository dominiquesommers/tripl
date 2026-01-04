import {Component, Input, input, Signal} from '@angular/core';
import { Route } from '../../models/route';

@Component({
  selector: 'app-route-tooltip',
  imports: [],
  standalone: true,
  templateUrl: './route-tooltip.html',
  styleUrl: './route-tooltip.css',
})
export class RouteTooltip {
  @Input({ required: true }) route!: Signal<Route | null>;
}
