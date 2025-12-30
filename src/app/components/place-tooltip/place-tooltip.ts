import { Component, input } from '@angular/core';

@Component({
  selector: 'app-place-tooltip',
  imports: [],
  standalone: true,
  templateUrl: './place-tooltip.html',
  styleUrl: './place-tooltip.css',
})
export class PlaceTooltip {
  name = input.required<string | undefined>();
}
