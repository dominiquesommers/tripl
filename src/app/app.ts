import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationStart, RoutesRecognized } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('tripl');
  private router = inject(Router);

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        console.log('🚀 Navigation Start:', event.url);
      }
      if (event instanceof RoutesRecognized) {
        console.log('✅ Route Recognized:', event.state.url);
      }
    });
  }
}
