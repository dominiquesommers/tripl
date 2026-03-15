import {Component, computed, Input, input, Signal} from '@angular/core';
import {Place} from '../../models/place';

@Component({
  selector: 'app-place-tooltip',
  imports: [],
  standalone: true,
  templateUrl: './place-tooltip.html',
  styleUrl: './place-tooltip.css',
})
export class PlaceTooltip {
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
