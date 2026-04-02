import { Pipe, PipeTransform, OnDestroy } from '@angular/core';
import { I18nService } from './i18n.service';
import { Subscription } from 'rxjs';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private lastKey = '';
  private lastParams: Record<string, string> | undefined;
  private lastValue = '';
  private subscription: Subscription;

  constructor(private readonly i18n: I18nService) {
    this.subscription = this.i18n.locale$.subscribe(() => {
      if (this.lastKey) {
        this.lastValue = this.i18n.translate(this.lastKey, this.lastParams);
      }
    });
  }

  transform(key: string, params?: Record<string, string>): string {
    if (key !== this.lastKey || params !== this.lastParams) {
      this.lastKey = key;
      this.lastParams = params;
      this.lastValue = this.i18n.translate(key, params);
    }
    return this.lastValue;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
