import { Component, input, output } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import {LucideAngularModule} from 'lucide-angular';

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, LucideAngularModule],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.css'
})
export class TabBar {
  /** * The list of tab names to display.
   * Example: ['itinerary', 'seasonality', 'cost']
   */
  tabs = input.required<string[]>();

  /** * The currently active tab, controlled by the parent.
   */
  activeTab = input.required<string>();

  /** * Emits the name of the tab that was clicked.
   */
  tabSelected = output<string>();

  /**
   * Handles the click event and notifies the parent shell.
   * @param tab The string identifier of the clicked tab.
   */
  handleTabClick(tab: string): void {
    if (tab !== this.activeTab()) {
      this.tabSelected.emit(tab);
    }
  }

  getIconName(tab: string): string {
    const icons: Record<string, string> = {
      'itinerary': 'route',
      'seasonality': 'cloud-sun',
      'cost': 'wallet',
      'warnings': 'triangle-alert',
      'bookings': 'ticket',      // For Place panel
      'activities': 'map-pin',    // For Place panel
      'notes': 'sticky-note',    // For Place panel
      'country': 'globe'         // For Place/Route panels
    };
    return icons[tab] || 'circle';
  }
}
