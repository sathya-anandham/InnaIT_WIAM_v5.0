import { TestBed } from '@angular/core/testing';
import { LoadingService } from './loading.interceptor';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LoadingService],
    });

    service = TestBed.inject(LoadingService);
  });

  it('should start with isLoading false', () => {
    expect(service.isLoading).toBeFalse();
  });

  it('increment() should set isLoading to true', () => {
    service.increment();
    expect(service.isLoading).toBeTrue();
  });

  it('decrement() should set isLoading to false after decrement to 0', () => {
    service.increment();
    expect(service.isLoading).toBeTrue();

    service.decrement();
    expect(service.isLoading).toBeFalse();
  });

  it('decrement() should not go below 0', () => {
    // Call decrement without any prior increment
    service.decrement();
    expect(service.isLoading).toBeFalse();

    // Call decrement multiple times
    service.decrement();
    service.decrement();
    expect(service.isLoading).toBeFalse();

    // Verify a single increment still works correctly after over-decrementing
    service.increment();
    expect(service.isLoading).toBeTrue();
  });

  it('loading$ should emit true when active requests > 0', (done) => {
    const emissions: boolean[] = [];

    service.loading$.subscribe((isLoading) => {
      emissions.push(isLoading);

      // After increment we expect [false, true]
      if (emissions.length === 2) {
        expect(emissions[0]).toBeFalse();
        expect(emissions[1]).toBeTrue();
        done();
      }
    });

    service.increment();
  });

  it('loading$ should emit false when all requests complete', (done) => {
    const emissions: boolean[] = [];

    service.loading$.subscribe((isLoading) => {
      emissions.push(isLoading);

      // After increment then decrement we expect [false, true, false]
      if (emissions.length === 3) {
        expect(emissions[0]).toBeFalse();
        expect(emissions[1]).toBeTrue();
        expect(emissions[2]).toBeFalse();
        done();
      }
    });

    service.increment();
    service.decrement();
  });
});
