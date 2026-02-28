import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditableBadge } from './editable-badge';

describe('EditableBadge', () => {
  let component: EditableBadge;
  let fixture: ComponentFixture<EditableBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditableBadge]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditableBadge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
