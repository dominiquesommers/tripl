import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../../services/trip';
import { LucideAngularModule } from 'lucide-angular';
import {EditableBadge} from '../../../../components/ui/editable-badge/editable-badge';
import {Route} from '../../../../models/route';


@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './bookings.html',
  styleUrl: './bookings.css'
})
export class Bookings {
  public tripService = inject(TripService);
  route = input.required<Route>();

}
