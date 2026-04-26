import {Component, computed, inject, Input, input, Signal} from '@angular/core';
import {Place} from '../../models/place';
import {AuthService} from '../../services/auth';

@Component({
  selector: 'app-place-tooltip',
  imports: [],
  standalone: true,
  templateUrl: './place-tooltip.html',
  styleUrl: './place-tooltip.css',
})
export class PlaceTooltip {
  authService = inject(AuthService);

  @Input() place!: Signal<Place | null>;

  sortedVisits = computed(() => {
    return this.place()?.visits()
      .filter(v => v.entryDate() !== null)
      .sort((a, b) => {
        const dateA = a.entryDate()?.getTime() ?? 0;
        const dateB = b.entryDate()?.getTime() ?? 0;
        return dateA - dateB;
      }) ?? [];
  });
}
