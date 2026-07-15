import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

export class TripViewReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === curr.routeConfig
      ? super.shouldReuseRoute(future, curr)
      : future.routeConfig?.component === curr.routeConfig?.component;
  }
}