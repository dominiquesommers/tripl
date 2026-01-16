import { signal } from '@angular/core';
import type { Map as MapboxMap, GeoJSONSource, Marker, Popup } from 'mapbox-gl';
import {
  MAP_STYLES,
  OFFLINE_BASE_STYLE,
  ROUTE_COLOR_EXPRESSION,
  ROUTE_ICONS
} from '../config/map-styles.config';
import { AuthService } from '../../../services/auth';


export class MapLayerManager {
  currentStyle = signal<string>('');
  routesLayerReady = signal<boolean>(false);

  constructor(
    private map: MapboxMap,
    private authService: AuthService,
  ) {}

  private getStyle(user: any, plan: any) {
    return (!user) ? MAP_STYLES.LOGGED_OUT : (!plan ? MAP_STYLES.LOGGED_IN : MAP_STYLES.ACTIVE_TRIP);
  }

  public updateStyle(user: any, plan: any) {
    const isOffline = this.authService.isOfflineMode();
    const nextStyle = isOffline ? MAP_STYLES.OFFLINE : this.getStyle(user, plan);
    if (this.currentStyle() !== nextStyle) {
      if (nextStyle === MAP_STYLES.OFFLINE) {
        this.map.setStyle(OFFLINE_BASE_STYLE);
      } else {
        this.map.setStyle(`mapbox://styles/mapbox/${nextStyle}?optimize=true`);
      }
      this.currentStyle.set(nextStyle);
    }
  }

  // The helper accepts raw GeoJSON, not a Signal
  public updateRouteData(data: GeoJSON.FeatureCollection) {
    const source = this.map.getSource('all-routes') as GeoJSONSource;
    if (this.routesLayerReady() && source) {
      source.setData(data);
    }
  }

  public setLayerVisibility(type: string, isVisible: boolean) {
    const visibility = isVisible ? 'visible' : 'none';
    this.map.setLayoutProperty(`route-layer-${type}`, 'visibility', visibility);
  }

  initializeRouteLayers(data?: any) {
    this.routesLayerReady.set(false);
    // 1. DATA SOURCE (Shared by all three layers)
    if (!this.map.getSource('all-routes')) {
      this.map.addSource('all-routes', {
        type: 'geojson',
        data: data || {type: 'FeatureCollection', features: []},
        // generateId: true
      });
    }

    // 2. THE LINE LAYER
    if (!this.map.getLayer('route-lines')) {
      this.map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'all-routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 6,
            ['boolean', ['feature-state', 'disabled'], false], 1.5,
            3 //2.4
          ],
          'line-color': ROUTE_COLOR_EXPRESSION,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 0.8,
            ['boolean', ['feature-state', 'disabled'], false], 0.2,
            0.8
          ]
        }
      });
    }

    if (!this.map.getLayer('route-icons-bg')) {
      this.map.addLayer({
        id: 'route-icons-bg',
        type: 'symbol',
        source: 'all-routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 150,
          // Use a generic circle icon or 'circle-15' from mapbox styles
          'icon-image': 'icon_marker',
          'icon-size': 1.3, // Make it slightly larger than the type icon
          'icon-allow-overlap': true,
          'icon-rotate': -90, // Adjust this so the "tip" points along the line
          'icon-rotation-alignment': 'map',
          'icon-offset': [0, 3],
          'icon-keep-upright': false
        },
        paint: {
          'icon-color': 'rgba(45, 45, 50, 0.85)', // ROUTE_COLOR_EXPRESSION
          'icon-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 1,
            ['boolean', ['feature-state', 'disabled'], false], 0.1,
            0.8
          ]
        }
      });
    }
    // TODO separate layer for flying icons which rotate.
    // 3. THE BASE ICON LAYER (Static size)
    if (!this.map.getLayer('route-icons')) {
      this.map.addLayer({
        id: 'route-icons',
        type: 'symbol',
        source: 'all-routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 150,
          'icon-image': [
            'match', ['get', 'type'],
            'driving', ROUTE_ICONS.driving,
            'boat', ROUTE_ICONS.boat,
            'flying', ROUTE_ICONS.flying,
            'bus', ROUTE_ICONS.bus,
            'train', ROUTE_ICONS.train,
            ROUTE_ICONS.undefined
          ],
          'icon-size': 0.5,
          'icon-allow-overlap': true,
          'icon-keep-upright': true,
          'icon-rotation-alignment': 'viewport',
        },
        paint: {
          'icon-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], '#ffffff',
            ['boolean', ['feature-state', 'disabled'], false], '#323232',
            '#ffffff'
          ],
          'icon-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 1,
            ['boolean', ['feature-state', 'disabled'], false], 0.2,
            0.8
          ]
        }
      });

      if (!this.map.getSource('drawing-line')) {
        this.map.addSource('drawing-line', {
          type: 'geojson',
          data: {type: 'FeatureCollection', features: []}
        });
      }

      if (!this.map.getLayer('drawing-line')) {
        this.map.addLayer({
          id: 'drawing-line-layer',
          type: 'line',
          source: 'drawing-line',
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
            'visibility': 'none' // Hidden by default
          },
          paint: {
            'line-color': '#252525',
            'line-width': 3,
            'line-dasharray': [2, 2], // Creates the dashed effect
            'line-opacity': 0.6
          }
        });
      }
    }

    // 4. THE HIGHLIGHT ICON LAYER (The "Pop" layer)
    // if (!map.getLayer('route-icons-hover')) {
    //   map.addLayer({
    //     id: 'route-icons-hover',
    //     type: 'symbol',
    //     source: 'all-routes',
    //     layout: {
    //       'symbol-placement': 'line',
    //       'symbol-spacing': 150,
    //       'icon-image': [
    //         'match', ['get', 'type'],
    //         'driving', ROUTE_ICONS.driving,
    //         'boat', ROUTE_ICONS.boat,
    //         'flying', ROUTE_ICONS.flying,
    //         'bus', ROUTE_ICONS.bus,
    //         'train', ROUTE_ICONS.train,
    //         ROUTE_ICONS.undefined
    //       ],
    //       'icon-size': 2, // SIGNIFICANTLY LARGER
    //       'icon-allow-overlap': true,
    //       'icon-rotation-alignment': 'map'
    //     },
    //     // We start with a filter that matches nothing
    //     filter: ['==', ['id'], '']
    //   });
    // }

    // if (!map.getLayer('route-directions')) {
    //   map.addLayer({
    //     id: 'route-directions',
    //     type: 'symbol',
    //     source: 'all-routes',
    //     layout: {
    //       'symbol-placement': 'line',
    //       'symbol-spacing': 150,
    //       'icon-image': ROUTE_ICONS.direction,
    //       'icon-size': 0.8,
    //       'icon-allow-overlap': true,
    //       'icon-rotate': 90, // Adjust this so the "tip" points along the line
    //       'icon-rotation-alignment': 'map',
    //       'icon-offset': [0, -15],
    //       'icon-keep-upright': false
    //     },
    //     paint: {
    //       'icon-color': [
    //         'match', ['get', 'type'],
    //         'driving', ROUTE_COLORS.driving,
    //         'boat', ROUTE_COLORS.boat,
    //         'flying', ROUTE_COLORS.flying,
    //         'bus', ROUTE_COLORS.bus,
    //         'train', ROUTE_COLORS.train,
    //         ROUTE_COLORS.undefined
    //       ],
    //       // Adding a white halo is recommended so the icon is visible
    //       // against the line of the same color
    //       // 'icon-halo-color': '#ffffff',
    //       // 'icon-halo-width': 1.5,
    //       'icon-opacity': [
    //         'case',
    //         ['boolean', ['feature-state', 'disabled'], false], 0.2,
    //         ['boolean', ['feature-state', 'hover'], false], 0, // Hide base icon when hovered
    //         1
    //       ]
    //     }
    //   });
    // }
    this.routesLayerReady.set(true);
  }

  public highlightRoute(selectedId: string | null) {
    // You can use a 'case' or 'match' logic here or simply
    // update a filter on a "highlight" layer
    this.map.setFilter('route-highlight-layer', [
      '==', ['get', 'id'], selectedId ?? ''
    ]);

    if (selectedId) {
      this.map.setPaintProperty('all-routes-layer', 'line-opacity', 0.2);
    } else {
      this.map.setPaintProperty('all-routes-layer', 'line-opacity', 1);
    }
  }

  /**
   * Refreshes the actual GeoJSON data
   */
  public setSourceData(data: any) {
    const source = this.map.getSource('all-routes') as mapboxgl.GeoJSONSource;
    source?.setData(data);
  }
}
