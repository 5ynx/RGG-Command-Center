import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VideoCalls } from './video-calls';

describe('VideoCalls', () => {
  let component: VideoCalls;
  let fixture: ComponentFixture<VideoCalls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoCalls]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VideoCalls);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
