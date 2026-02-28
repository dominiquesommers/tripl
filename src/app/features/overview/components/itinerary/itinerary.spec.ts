import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Itinerary } from './itinerary';

describe('Itinerary', () => {
  let component: Itinerary;
  let fixture: ComponentFixture<Itinerary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Itinerary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Itinerary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
