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
import { correlationInterceptor } from './correlation.interceptor';

describe('correlationInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should add X-Correlation-ID header to requests', () => {
    http.get('/api/test').subscribe();

    const req = httpTesting.expectOne('/api/test');
    expect(req.request.headers.has('X-Correlation-ID')).toBeTrue();
    req.flush({});
  });

  it('should use a valid UUID format', () => {
    http.get('/api/test').subscribe();

    const req = httpTesting.expectOne('/api/test');
    const correlationId = req.request.headers.get('X-Correlation-ID');
    expect(correlationId).toBeTruthy();
    expect(correlationId).toMatch(UUID_REGEX);
    req.flush({});
  });

  it('should generate different IDs for different requests', () => {
    http.get('/api/first').subscribe();
    http.get('/api/second').subscribe();

    const requests = httpTesting.match((req) =>
      req.url === '/api/first' || req.url === '/api/second',
    );
    expect(requests.length).toBe(2);

    const id1 = requests[0].request.headers.get('X-Correlation-ID');
    const id2 = requests[1].request.headers.get('X-Correlation-ID');

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);

    requests.forEach((req) => req.flush({}));
  });
});
