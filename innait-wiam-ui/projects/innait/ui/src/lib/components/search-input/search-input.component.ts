import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

@Component({
  selector: 'innait-search-input',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule],
  template: `
    <span class="p-input-icon-left">
      <i class="pi pi-search"></i>
      <input pInputText type="text" [placeholder]="placeholder" [(ngModel)]="value" (ngModelChange)="onInput($event)" />
    </span>
  `,
})
export class SearchInputComponent implements OnInit, OnDestroy {
  @Input() placeholder = 'Search...';
  @Input() debounce = 300;
  @Output() search = new EventEmitter<string>();

  value = '';
  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(this.debounce),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe((term) => this.search.emit(term));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(value: string): void {
    this.search$.next(value);
  }
}
