import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaceTooltip } from './place-tooltip';

describe('PlaceTooltip', () => {
  let component: PlaceTooltip;
  let fixture: ComponentFixture<PlaceTooltip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceTooltip]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaceTooltip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
