import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MissedCalls } from './missed-calls';

describe('MissedCalls', () => {
  let component: MissedCalls;
  let fixture: ComponentFixture<MissedCalls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MissedCalls]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MissedCalls);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
