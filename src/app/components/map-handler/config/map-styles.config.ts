export const INITIAL_CENTER: [number, number] = [2.35, 48.85];
export const INITIAL_ZOOM = 3.2;
export const MAP_STYLES = {
  LOGGED_OUT: 'dark-v11',
  LOGGED_IN: 'light-v11',
  ACTIVE_TRIP: 'streets-v12'
};


export const ROUTE_COLORS = {
  driving: '#3887be',
  boat: '#ff8c42',
  flying: '#fcba03',
  bus: '#e55e5e',
  train: '#ae8a41',
  undefined: '#707070'
} as const;


export const ROUTE_ICONS = {
  driving: 'icon_driving',
  flying: 'icon_flying',
  boat: 'icon_boat',
  bus: 'icon_bus',
  train: 'icon_train',
  undefined: 'icon_marker',
  icon_marker: 'icon_marker',
} as const;


// 2. Mapbox Style Expressions
// Moving these here prevents your LayerManager from having "magic strings"
export const ROUTE_COLOR_EXPRESSION = [
  'match', ['get', 'type'],
  'driving', ROUTE_COLORS.driving,
  'flying', ROUTE_COLORS.flying,
  'boat', ROUTE_COLORS.boat,
  'bus', ROUTE_COLORS.bus,
  'train', ROUTE_COLORS.train,
  ROUTE_COLORS.undefined
];

// 3. The Offline "Base" Style
export const OFFLINE_BASE_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#1a1a1a' }
    }
  ]
};
