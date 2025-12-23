import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';


import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ onSameUrlNavigation: 'ignore', paramsInheritanceStrategy: 'always' }),
      ...(isDevMode() ? [] : [withHashLocation()])
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient()
  ]
};
