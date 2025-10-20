import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GateControl } from './gate-control';

describe('GateControl', () => {
  let component: GateControl;
  let fixture: ComponentFixture<GateControl>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GateControl]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GateControl);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
