import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CostBadge } from './cost-badge';

describe('CostBadge', () => {
  let component: CostBadge;
  let fixture: ComponentFixture<CostBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CostBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CostBadge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
