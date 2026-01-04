import {Component, input, output} from '@angular/core';
import {Route} from '../../models/route';

@Component({
  selector: 'app-route-popup',
  standalone: true,
  imports: [],
  templateUrl: './route-popup.html',
  styleUrl: './route-popup.css',
})
export class RoutePopup {
  route = input.required<Route>();
  onSave = output<{id: string, name: string}>();
  onDelete = output<string>();

  save(newName: string) {
    this.onSave.emit({ id: this.route().id, name: newName });
  }

  delete() {
    this.onDelete.emit(this.route().id);
  }
}
