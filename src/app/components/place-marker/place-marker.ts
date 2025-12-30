import {Component, input} from '@angular/core';

@Component({
  selector: 'app-place-marker',
  imports: [],
  templateUrl: './place-marker.html',
  styleUrl: './place-marker.css',
})
export class PlaceMarker {
  visits = input.required<{nights: number}[]>();
}
