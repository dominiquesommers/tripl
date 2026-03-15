import {
  Injectable, ApplicationRef, createComponent,
  EnvironmentInjector, ComponentRef, Type
} from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PopupService {
  private ref?: ComponentRef<any>;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  open<T>(
    component: Type<T>,
    config: {
      position: { top: number; left: number };
      inputs?: Partial<Record<string, any>>;
      outputs?: Partial<Record<string, (value: any) => void>>;
    }
  ): ComponentRef<T> {
    this.close();

    const ref = createComponent(component, { environmentInjector: this.injector });

    // Set inputs
    if (config.inputs) {
      for (const [key, value] of Object.entries(config.inputs)) {
        ref.setInput(key, value);
      }
    }

    // Wire outputs
    if (config.outputs) {
      for (const [key, handler] of Object.entries(config.outputs)) {
        const output = (ref.instance as any)[key];
        if (output?.subscribe) {
          output.subscribe(handler);
        }
      }
    }

    // Position on body
    const el = ref.location.nativeElement as HTMLElement;
    el.style.position = 'fixed';
    el.style.top = config.position.top + 'px';
    el.style.left = config.position.left + 'px';
    el.style.transform = 'translateX(-50%)';
    el.style.zIndex = '9999';
    el.setAttribute('data-popup', '');

    this.appRef.attachView(ref.hostView);
    document.body.appendChild(el);
    this.ref = ref;

    return ref as ComponentRef<T>;
  }

  close() {
    if (this.ref) {
      this.appRef.detachView(this.ref.hostView);
      this.ref.destroy();
      this.ref = undefined;
    }
  }

  isOpen(): boolean {
    return !!this.ref;
  }
}
