import {Component, inject, signal, input, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabBar } from '../../../components/tab-bar/tab-bar';
import { Bookings } from '../components/bookings/bookings';
import { Activities } from '../components/activities/activities';
import { Notes } from '../components/notes/notes';
import { Country } from '../components/country/country';
import {Visit} from '../../../models/visit';
import {ActivatedRoute, Router} from '@angular/router';
import {UiService} from '../../../services/ui';


@Component({
  selector: 'app-place-panel',
  standalone: true,
  imports: [CommonModule, TabBar, Bookings, Activities, Notes, Country],
  templateUrl: './place-panel.html',
  styleUrl: './place-panel.css'
})
export class PlacePanel {
  visit = input.required<Visit>();

  uiService = inject(UiService);
  placeTabs = ['bookings', 'activities', 'notes', 'country'];
}
