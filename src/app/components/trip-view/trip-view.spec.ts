import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripView } from './trip-view';

describe('TripView', () => {
  let component: TripView;
  let fixture: ComponentFixture<TripView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TripView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
