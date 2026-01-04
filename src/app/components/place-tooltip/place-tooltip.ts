import {Component, Input, input, Signal} from '@angular/core';
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
  // name = input.required<string | undefined>();
}
