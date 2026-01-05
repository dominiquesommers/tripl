import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisitPopup } from './visit-popup';

describe('PlacePopup', () => {
  let component: VisitPopup;
  let fixture: ComponentFixture<VisitPopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisitPopup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisitPopup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
