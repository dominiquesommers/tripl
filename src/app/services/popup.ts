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
    el.style.zIndex = '9999';
    el.setAttribute('data-popup', '');

    this.appRef.attachView(ref.hostView);
    document.body.appendChild(el);
    this.ref = ref;

    const padding = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const popupWidth = el.offsetWidth;
    const popupHeight = el.offsetHeight;
    let targetLeft = config.position.left - (popupWidth / 2);
    let targetTop = config.position.top;
    // Constrain Left and Right edges
    if (targetLeft < padding) {
      targetLeft = padding; // Clamp to left screen edge
    } else if (targetLeft + popupWidth > vw - padding) {
      targetLeft = vw - popupWidth - padding; // Clamp to right screen edge
    }

    // Constrain Top and Bottom edges
    if (targetTop < padding) {
      targetTop = padding; // Clamp to top screen edge
    } else if (targetTop + popupHeight > vh - padding) {
      targetTop = vh - popupHeight - padding; // Clamp to bottom screen edge
    }

    el.style.left = `${targetLeft}px`;
    el.style.top = `${targetTop}px`;
    el.style.transform = 'none';

    // el.style.top = config.position.top + 'px';
    // el.style.left = config.position.left + 'px';
    // el.style.transform = 'translateX(-50%)';

    // console.log(config.position);
    // console.log(el.style.left, el.style.top);

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
