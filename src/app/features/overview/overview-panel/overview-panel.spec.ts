import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewPanel } from './overview-panel';

describe('OverviewPanel', () => {
  let component: OverviewPanel;
  let fixture: ComponentFixture<OverviewPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OverviewPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
