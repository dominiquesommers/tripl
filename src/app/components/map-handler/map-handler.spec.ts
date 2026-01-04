import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapHandler } from './map-handler';

describe('Map', () => {
  let component: MapHandler;
  let fixture: ComponentFixture<MapHandler>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapHandler]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapHandler);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
