import { TestBed } from '@angular/core/testing';
import { OfflineService } from './offline.service';

describe('OfflineService', () => {
  let service: OfflineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfflineService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should reflect current navigator.onLine status', () => {
    expect(service.currentStatus).toBe(navigator.onLine);
  });

  it('should emit online status via observable', (done) => {
    service.isOnline.subscribe((online) => {
      expect(typeof online).toBe('boolean');
      done();
    });
  });

  it('should react to offline event', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.currentStatus).toBe(false);
  });

  it('should react to online event', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.currentStatus).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(service.currentStatus).toBe(true);
  });
});
