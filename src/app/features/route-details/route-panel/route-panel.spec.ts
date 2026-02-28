import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoutePanel } from './route-panel';

describe('RoutePanel', () => {
  let component: RoutePanel;
  let fixture: ComponentFixture<RoutePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoutePanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoutePanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
