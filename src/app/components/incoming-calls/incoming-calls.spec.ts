import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IncomingCalls } from './incoming-calls';

describe('IncomingCalls', () => {
  let component: IncomingCalls;
  let fixture: ComponentFixture<IncomingCalls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomingCalls]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IncomingCalls);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
