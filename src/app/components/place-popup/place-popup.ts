import {Component, input, output} from '@angular/core';
import {Place} from '../../models/place';

@Component({
  selector: 'app-place-popup',
  standalone: true,
  imports: [],
  templateUrl: './place-popup.html',
  styleUrl: './place-popup.css',
})
export class PlacePopup {
  place = input.required<Place>();
  onSave = output<{id: string, name: string}>();
  onDelete = output<string>();

  save(newName: string) {
    this.onSave.emit({ id: this.place().id, name: newName });
  }

  delete() {
    this.onDelete.emit(this.place().id);
  }
}
