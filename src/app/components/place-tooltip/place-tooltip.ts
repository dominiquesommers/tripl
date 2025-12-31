import {Component, Input, input, Signal} from '@angular/core';

@Component({
  selector: 'app-place-tooltip',
  imports: [],
  standalone: true,
  templateUrl: './place-tooltip.html',
  styleUrl: './place-tooltip.css',
})
export class PlaceTooltip {
  @Input() name!: Signal<string>;
  // name = input.required<string | undefined>();
}
