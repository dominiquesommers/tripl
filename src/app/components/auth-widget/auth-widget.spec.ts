import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthWidget } from './auth-widget';

describe('AuthWidget', () => {
  let component: AuthWidget;
  let fixture: ComponentFixture<AuthWidget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthWidget]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AuthWidget);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
