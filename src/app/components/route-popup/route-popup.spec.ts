import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutePopup } from './route-popup';

describe('RoutePopup', () => {
  let component: RoutePopup;
  let fixture: ComponentFixture<RoutePopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutePopup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutePopup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
