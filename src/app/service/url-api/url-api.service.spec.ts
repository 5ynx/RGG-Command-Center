import { TestBed } from '@angular/core/testing';

import { UrlApiService } from './url-api.service';

describe('UrlApiService', () => {
  let service: UrlApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UrlApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
