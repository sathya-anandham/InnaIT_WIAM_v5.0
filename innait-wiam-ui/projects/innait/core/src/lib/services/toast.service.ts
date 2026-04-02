import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

export type ToastSeverity = 'success' | 'warn' | 'error' | 'info';

export interface ToastOptions {
  summary?: string;
  detail: string;
  severity?: ToastSeverity;
  life?: number;
  sticky?: boolean;
  key?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private messageService: MessageService | null = null;

  /**
   * Called once from AppComponent to provide the MessageService instance.
   * PrimeNG MessageService must be provided in the component tree.
   */
  register(messageService: MessageService): void {
    this.messageService = messageService;
  }

  success(detail: string, summary = 'Success'): void {
    this.show({ severity: 'success', summary, detail, life: 5000 });
  }

  info(detail: string, summary = 'Info'): void {
    this.show({ severity: 'info', summary, detail, life: 5000 });
  }

  warn(detail: string, summary = 'Warning'): void {
    this.show({ severity: 'warn', summary, detail, life: 5000 });
  }

  error(detail: string, summary = 'Error'): void {
    this.show({ severity: 'error', summary, detail, life: 8000 });
  }

  clear(): void {
    this.messageService?.clear();
  }

  private show(options: ToastOptions): void {
    if (!this.messageService) {
      console.warn('[ToastService] MessageService not registered. Call register() from AppComponent.');
      return;
    }
    this.messageService.add({
      severity: options.severity ?? 'info',
      summary: options.summary,
      detail: options.detail,
      life: options.sticky ? undefined : (options.life ?? 5000),
      sticky: options.sticky ?? false,
      key: options.key,
    });
  }
}
