import {Component, input, output} from '@angular/core';
import { Place } from '../../models/place';
import { Visit } from '../../models/visit';

@Component({
  selector: 'app-visit-popup',
  standalone: true,
  imports: [],
  templateUrl: './visit-popup.html',
  styleUrl: './visit-popup.css',
})
export class VisitPopup {
  visit = input.required<Visit>();
  onSave = output<{id: string, name: string}>();
  onDelete = output<string>();

  save(newName: string) {
    const place = this.visit().place;
    if (!place) return;
    this.onSave.emit({ id: place.id, name: newName });
  }

  delete() {
    this.onDelete.emit(this.visit().id);
  }
}
