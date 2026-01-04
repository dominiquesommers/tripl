import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RouteTooltip } from './route-tooltip';

describe('RouteTooltip', () => {
  let component: RouteTooltip;
  let fixture: ComponentFixture<RouteTooltip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteTooltip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RouteTooltip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
