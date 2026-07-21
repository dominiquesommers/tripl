import { computed, inject, Component, input, output } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import {LucideAngularModule} from 'lucide-angular';
import { UiService } from '../../services/ui';


export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  getValue?: () => number | string;
}

@Component({
  selector: 'app-tab-bar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './tab-bar.html',
  styleUrl: './tab-bar.css'
})
export class TabBar {
  uiService = inject(UiService);

  isPeek = computed(() => this.uiService.isMobile() && this.uiService.sheetState() === 'peek');

  /** * The list of tab names to display.
   * Example: ['itinerary', 'seasonality', 'cost']
   */
  // tabs = input.required<string[]>();
  tabs = input.required<TabConfig[]>();

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
      if (this.uiService.isMobile() && this.uiService.sheetState() === 'peek') {
        this.uiService.sheetState.set('half');
      }
    }
  }
}
