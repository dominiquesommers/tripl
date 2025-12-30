import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlacePopup } from './place-popup';

describe('PlacePopup', () => {
  let component: PlacePopup;
  let fixture: ComponentFixture<PlacePopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlacePopup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlacePopup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
