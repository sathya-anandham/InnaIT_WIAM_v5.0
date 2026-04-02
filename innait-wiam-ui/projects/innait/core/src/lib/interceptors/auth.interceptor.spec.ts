import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    // Clean up the XSRF-TOKEN cookie by expiring it
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  it('should add X-XSRF-TOKEN header when cookie exists', () => {
    document.cookie = 'XSRF-TOKEN=test-token; path=/;';

    http.get('/api/test').subscribe();

    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.get('X-XSRF-TOKEN')).toBe('test-token');
    req.flush({});
  });

  it('should not add header when no XSRF cookie', () => {
    // Ensure cookie is cleared
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

    http.get('/api/test').subscribe();

    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBeFalse();
    req.flush({});
  });

  it('should pass request through to next handler', () => {
    http.get('/api/data').subscribe((response) => {
      expect(response).toEqual({ result: 'ok' });
    });

    const req = httpTesting.expectOne('/api/data');
    expect(req.request.method).toBe('GET');
    req.flush({ result: 'ok' });
  });
});
