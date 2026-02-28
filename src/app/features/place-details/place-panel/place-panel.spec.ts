import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlacePanel } from './place-panel';

describe('PlacePanel', () => {
  let component: PlacePanel;
  let fixture: ComponentFixture<PlacePanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlacePanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlacePanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
