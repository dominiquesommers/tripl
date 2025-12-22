import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TripBubble } from './trip-bubble';

describe('TripBubble', () => {
  let component: TripBubble;
  let fixture: ComponentFixture<TripBubble>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripBubble]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TripBubble);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
