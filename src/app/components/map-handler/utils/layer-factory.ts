import { signal } from '@angular/core';
import type { Map as MapboxMap, GeoJSONSource, Marker, Popup } from 'mapbox-gl';
import {
  MAP_STYLES,
  OFFLINE_BASE_STYLE,
  ROUTE_COLOR_EXPRESSION,
  ROUTE_ICONS
} from '../config/map-styles.config';
import { AuthService } from '../../../services/auth';
import { Trip } from '../../../models/trip';


export const ALIGNED_ROUTE_TYPES = ['flying', 'walking'] as const;

export class MapLayerManager {
  currentStyle = signal<string>('');
  routesLayerReady = signal<boolean>(false);

  constructor(
    private map: MapboxMap,
    private authService: AuthService,
  ) {}

  private getStyle(user: any, trip: Trip | null) {
    return (!user) ? MAP_STYLES.LOGGED_OUT : (!trip ? MAP_STYLES.LOGGED_IN : MAP_STYLES.ACTIVE_TRIP);
  }

  public computeTargetStyle(user: any, trip: Trip | null) {
    return trip
        ? MAP_STYLES.ACTIVE_TRIP
        : (user ? MAP_STYLES.LOGGED_IN : MAP_STYLES.LOGGED_OUT);
  }

  public updateStyle(user: any, trip: Trip | null) {
    const targetStyle = this.computeTargetStyle(user, trip);
    if (this.currentStyle() === targetStyle) return;
    this.currentStyle.set(targetStyle);
    this.routesLayerReady.set(false);   // mark layers gone right away
    this.map.setStyle(`mapbox://styles/mapbox/${targetStyle}?optimize=true`);
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
        data: data || {type: 'FeatureCollection', features: []}
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
            ['boolean', ['feature-state', 'hover'], false], 4,
            ['boolean', ['feature-state', 'disabled'], false], 2.5,
            3
          ],
          'line-color': ROUTE_COLOR_EXPRESSION,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 1,
            ['boolean', ['feature-state', 'disabled'], false], 0.2,
            0.8
          ],
          'line-dasharray': [
            'match', ['get', 'traversedAs'],
            'tour', ['literal', [2, 3]],      // Dashed (2 unit line, 3 unit gap)
            'both', ['literal', [0.5, 2]],    // Dotted (short dot, wider gap)
            'segment', ['literal', [1, 0]],   // Solid (1 unit line, 0 gap)
            ['literal', [1, 0]]               // Default / null fallback: Solid
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
          'icon-image': 'map-pin',
          'icon-size': 0.85,
          'icon-allow-overlap': true,
          'icon-rotate': -90,
          'icon-rotation-alignment': 'map',
          'icon-offset': [0, 2.5],
          'icon-keep-upright': false
        },
        paint: {
          'icon-color': ROUTE_COLOR_EXPRESSION,
          'icon-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false], 1,
            ['boolean', ['feature-state', 'disabled'], false], 0.2,
            0.8
          ]
        }
      });
    }

    // 3. THE BASE ICON LAYER (Static size)
    if (!this.map.getLayer('route-icons')) {
      this.map.addLayer({
        id: 'route-icons',
        type: 'symbol',
        source: 'all-routes',
        filter: ['!', ['in', ['get', 'type'], ['literal', ALIGNED_ROUTE_TYPES]]],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 150,
          'icon-image': [
            'match', ['get', 'type'],
            'driving', ROUTE_ICONS.driving,
            'boat', ROUTE_ICONS.boat,
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
            ['boolean', ['feature-state', 'hover'], false], '#121212',
            ['boolean', ['feature-state', 'disabled'], false], '#a5a5a5',
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

      if (!this.map.getSource('route-icons-aligned')) {
        this.map.addLayer({
          id: 'route-icons-aligned',
          type: 'symbol',
          source: 'all-routes',
          filter: ['in', ['get', 'type'], ['literal', ALIGNED_ROUTE_TYPES]],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 150,
            'icon-image': ROUTE_ICONS.flying,
            'icon-size': 0.5,
            'icon-allow-overlap': true,
            'icon-rotation-alignment': 'map',
            'icon-pitch-alignment': 'map',
            'icon-keep-upright': false,
            'icon-rotate': 45
          },
          paint: {
            'icon-color': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], '#121212',
              ['boolean', ['feature-state', 'disabled'], false], '#a5a5a5',
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
      }

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
            'visibility': 'none'
          },
          paint: {
            'line-color': '#252525',
            'line-width': 3,
            'line-dasharray': [2, 2],
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
