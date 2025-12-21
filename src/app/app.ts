import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Map } from './components/map/map';
import { AuthWidgetComponent } from './components/auth-widget/auth-widget';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Map, AuthWidgetComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('tripl');
}
