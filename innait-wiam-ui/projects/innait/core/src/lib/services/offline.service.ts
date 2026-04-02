import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, Subject, takeUntil, map, startWith } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OfflineService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly online$ = new BehaviorSubject<boolean>(navigator.onLine);

  constructor() {
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false)),
    )
      .pipe(startWith(navigator.onLine), takeUntil(this.destroy$))
      .subscribe((status) => this.online$.next(status));
  }

  get isOnline(): Observable<boolean> {
    return this.online$.asObservable();
  }

  get currentStatus(): boolean {
    return this.online$.getValue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
