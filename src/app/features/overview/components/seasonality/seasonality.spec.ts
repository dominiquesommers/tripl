import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Seasonality } from './seasonality';

describe('Seasonality', () => {
  let component: Seasonality;
  let fixture: ComponentFixture<Seasonality>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Seasonality]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Seasonality);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
