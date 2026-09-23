import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CostOverview } from './cost-overview';

describe('CostOverview', () => {
  let component: CostOverview;
  let fixture: ComponentFixture<CostOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CostOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CostOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
