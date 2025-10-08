import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoryCalls } from './history-calls';

describe('HistoryCalls', () => {
  let component: HistoryCalls;
  let fixture: ComponentFixture<HistoryCalls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryCalls]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryCalls);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
