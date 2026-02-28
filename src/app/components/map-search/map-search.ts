import {Component, ElementRef, inject, Input, signal, Signal, ViewChild} from '@angular/core';
import {environment} from '../../../environments/environment';
import type { Map as MapboxMap } from 'mapbox-gl';
import { LucideAngularModule, Search } from 'lucide-angular';
import {CommonModule} from '@angular/common';
import {PlaceMarker} from '../place-marker/place-marker';
import {VisitPopup} from '../visit-popup/visit-popup';
import {PlaceTooltip} from '../place-tooltip/place-tooltip';
import {RouteTooltip} from '../route-tooltip/route-tooltip';
import {UiService} from '../../services/ui';
import {TripService} from '../../services/trip';


@Component({
  selector: 'app-map-search',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './map-search.html',
  styleUrls: ['./map-search.css']
})
export class MapSearch {
  uiService = inject(UiService);
  tripService = inject(TripService);

  @Input({ required: true }) map!: MapboxMap;

  @ViewChild('searchWrapper', { static: true }) searchWrapper!: ElementRef;

  readonly SearchIcon = Search;

  private searchBoxElement: any;

  async ngOnInit() {
    const { MapboxSearchBox } = await import('@mapbox/search-js-web');
    this.searchBoxElement = new MapboxSearchBox();
    this.searchBoxElement.accessToken = environment.mapboxToken;
    this.searchBoxElement.bindMap(this.map);

    this.searchBoxElement.theme = {
      variables: {
        colorBackground: 'rgba(30, 30, 35, 0.7)',
        backdropFilter: 'blur(30px) saturate(180%)',
        colorText: '#fff',
        borderRadius: '20px',
        width: '100%',
        boxShadow: 'none'
      },
      cssText: `
        .SearchIcon {
          display: none !important;
        }
        .Input {
          width: 100% !important;
          padding-left: 12px !important;
          color: #fff !important;
        }
        ::placeholder {
          color: #fff !important;
        }
        .Results {
          bottom: 53px !important;
          top: auto !important;
          margin-bottom: 6px !important;
          margin-top: 0 !important;
          transform: translateX(-37px) !important;
        }
        .Suggestion {
          color: #fff !important;          /* suggestion text white */
          background-color: rgba(0, 0, 0, 0.25) !important; /* hover background */
        }
        .Suggestion:hover,
        .Suggestion[aria-selected="true"] {
          background-color: rgba(0, 0, 0, 0.5) !important; /* selected item */
        }
      `
    };


    this.searchWrapper.nativeElement.appendChild(this.searchBoxElement);
    this.searchBoxElement.addEventListener('retrieve', (e: any) => {
      this.handleSearchResult(e);
    });
  }

  toggleSearch() {
    this.uiService.toggleSearch();
    if (this.uiService.isSearchExpanded()) {
      setTimeout(() => this.searchBoxElement.focus(), 100);
    }
  }

  handleSearchResult(event: any) {
    console.log(event);
    const feature = event.detail.features[0];
    this.uiService.closeSearch();
    // this.searchBoxElement.clear();
    this.searchBoxElement.blur();
    // this.topSuggestion = null;
    const name = feature.properties.name;
    const countryName = feature.properties.context.country.name;
    this.tripService.addPlace({ name, lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1], countryName })
      .subscribe({
        next: (addedPlace) => console.log('Place successfully added.'),
        error: (err) => console.error('Failed to add place', err)
      });
  }
}
