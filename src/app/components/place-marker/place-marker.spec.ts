import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaceMarker } from './place-marker';

describe('PlaceMarker', () => {
  let component: PlaceMarker;
  let fixture: ComponentFixture<PlaceMarker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceMarker]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaceMarker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
