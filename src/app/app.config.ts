import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LucideAngularModule, ArrowUpRight, Plane, MapPin, Moon, Trash2, Bus, Car, Ship, Footprints, Milestone,
  MoreVertical, Settings2, ArrowLeft, GripVertical, Check, X, Eye, EyeOff, MapPinCheck, MapPinX, MapPinMinus, MapPinPlus,
  MapPinOff, ChevronUp, ChevronDown, Plus} from 'lucide-angular';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

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
      LucideAngularModule.pick({
        Plane, MapPin, Moon, Trash2, Bus, Car, Ship, Footprints, Milestone, ChevronUp, ChevronDown, Plus,
        MoreVertical, ArrowUpRight, Settings2, ArrowLeft, GripVertical, Check, X, Eye, EyeOff, MapPinCheck, MapPinX,
        MapPinMinus, MapPinPlus, MapPinOff
      })
    )
  ]
};
