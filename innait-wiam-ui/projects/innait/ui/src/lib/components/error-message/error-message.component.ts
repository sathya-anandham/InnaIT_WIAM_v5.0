import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'innait-error-message',
  standalone: true,
  imports: [CommonModule, MessageModule],
  template: `
    <p-message *ngIf="message" [severity]="severity" [text]="message" />
  `,
})
export class ErrorMessageComponent {
  @Input() message = '';
  @Input() severity: 'error' | 'warn' | 'info' | 'success' = 'error';
  @Input() closable = false;
}
