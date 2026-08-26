import type {ExpressionSpecification, StyleSpecification} from 'mapbox-gl';
import {RouteType} from '../../../models/route';

export const INITIAL_CENTER: [number, number] = [2.35, 48.85];
export const INITIAL_ZOOM = 3.2;
export const MAP_STYLES = {
  LOGGED_OUT: 'dark-v11',
  LOGGED_IN: 'light-v11',
  ACTIVE_TRIP_: 'streets-v12',
  ACTIVE_TRIP: 'outdoors-v12',
  OFFLINE: 'OFFLINE_STYLE'
};

export const ROUTE_COLORS = {
  taxi: '#8e44ad',
  flying: '#f1c40f',
  driving: '#3887be',
  bus: '#d64550',
  train: '#7a4a2f',
  boat: '#ff8c42',
  walking: '#64748b',
  twowheeler: '#0f8b8d',
  other: '#95a5a6',
  undefined: '#707070',
} as const;

export const ROUTE_ICONS: Record<string, string> = {
  flying: 'plane',
  driving: 'car',
  bus: 'bus',
  train: 'train-front',
  boat: 'ship',
  walking: 'footprints',
  twowheeler: 'bike',
  taxi: 'car-taxi-front',
  other: 'mouse-pointer-2',
  undefined: 'mouse-pointer-2',
  icon_marker: 'icon_marker',
  map_pin: 'map-pin',
} as const;

// 2. Mapbox Style Expressions
// Moving these here prevents your LayerManager from having "magic strings"
export const ROUTE_COLOR_EXPRESSION: ExpressionSpecification = [
  'match', ['get', 'type'],
  'flying', ROUTE_COLORS.flying,
  'driving', ROUTE_COLORS.driving,
  'bus', ROUTE_COLORS.bus,
  'train', ROUTE_COLORS.train,
  'boat', ROUTE_COLORS.boat,
  'walking', ROUTE_COLORS.walking,
  'twowheeler', ROUTE_COLORS.twowheeler,
  'taxi', ROUTE_COLORS.taxi,
  'other', ROUTE_COLORS.other,
  ROUTE_COLORS.undefined
];

export const LAND_MODES: RouteType[] = ['driving', 'train', 'bus', 'walking', 'twowheeler', 'taxi', 'other'];

export const OFFLINE_BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#405e75' }
    }
  ]
};


// export const OFFLINE_BASE_STYLE: StyleSpecification = {
//   version: 8,
//   sources: {
//     'local-tiles': {
//       type: 'vector',
//       tiles: ['/tiles/{z}/{x}/{y}.pbf'], // Path to your cached/local tiles
//       maxzoom: 14
//     }
//   },
//   layers: [
//     {
//       id: 'background',
//       type: 'background',
//       paint: { 'background-color': '#405e75' }
//     },
//     {
//       id: 'local-roads',
//       type: 'line',
//       source: 'local-tiles',
//       'source-layer': 'transportation', // Dependent on your tile provider
//       paint: { 'line-color': '#444' }
//     }
//   ]
// };
