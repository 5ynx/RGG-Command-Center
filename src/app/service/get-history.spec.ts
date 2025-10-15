import { TestBed } from '@angular/core/testing';

import { GetHistory } from './get-history';

describe('GetHistory', () => {
  let service: GetHistory;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GetHistory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
