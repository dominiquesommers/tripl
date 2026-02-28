import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LucideAngularModule, ArrowUpRight, Plane, MapPin, Moon, Trash2, TrainFront, Bus, Car, Ship, Footprints, Milestone,
  MoreVertical, Settings2, ArrowLeft, GripVertical, Check, X, Eye, EyeOff, MapPinCheck, MapPinX, MapPinMinus, MapPinPlus,
  MapPinOff, ChevronUp, ChevronDown, Plus, Bed, Route, CloudSun, Wallet, TriangleAlert, Ticket, StickyNote, Globe, Home,
  Utensils, ShoppingBag, Hotel, Maximize2, Sigma, Activity, Circle, Clock, Info } from 'lucide-angular';

import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' })
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(),
    importProvidersFrom(
      MatSnackBarModule,
      LucideAngularModule.pick({
        Plane, MapPin, Moon, Trash2, Bus, Car, Ship, Footprints, Milestone, ChevronUp, ChevronDown, Plus,
        MoreVertical, ArrowUpRight, Settings2, ArrowLeft, GripVertical, Check, X, Eye, EyeOff, MapPinCheck, MapPinX,
        MapPinMinus, MapPinPlus, MapPinOff, TrainFront, Bed, Route, CloudSun, Wallet, TriangleAlert, Ticket, StickyNote, Globe,
        Home, Utensils, ShoppingBag, Hotel, Maximize2, Sigma, Activity, Circle, Clock, Info
      })
    ),
    provideAnimationsAsync()
  ]
};
