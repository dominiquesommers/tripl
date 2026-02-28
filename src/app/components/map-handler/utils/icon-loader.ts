import type { Map as MapboxMap, GeoJSONSource, Marker, Popup } from 'mapbox-gl';
import { ROUTE_ICONS } from '../config/map-styles.config';


export class IconLoader {
  constructor(private map: MapboxMap) {}

  async loadRouteIcons() {
    const iconEntries = Object.entries(ROUTE_ICONS);
    for (const [key, name] of iconEntries) {
      if (this.map.hasImage(name)) continue;
      const url = `./icons/${name}.png`; // Loading your new 128x128 PNGs
      const image = await new Promise<HTMLImageElement | ImageBitmap | undefined>((resolve) => {
        this.map.loadImage(url, (err, img: any) => {
          if (err) {
            console.error(`Failed to load icon: ${url}`, err);
            resolve(undefined);
          } else {
            resolve(img);
          }
        });
      });

      if (image && !this.map.hasImage(name)) {
        this.map.addImage(name, image, { sdf: true, pixelRatio: 4 });
      }
    }
  }
}

