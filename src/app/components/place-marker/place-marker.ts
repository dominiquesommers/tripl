import { Component, computed, Input, Signal } from '@angular/core';
import { Visit } from '../../models/visit';

@Component({
  selector: 'app-place-marker',
  imports: [],
  templateUrl: './place-marker.html',
  styleUrl: './place-marker.css',
})
export class PlaceMarker {
  @Input() visits!: Visit[];
  @Input() zoom!: Signal<number>;
  readonly isZoomLow = computed(() => (this.zoom?.() ?? 0) < 3);
}
