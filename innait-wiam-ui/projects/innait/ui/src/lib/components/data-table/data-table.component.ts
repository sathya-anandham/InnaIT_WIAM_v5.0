import { Component, EventEmitter, Input, Output, ContentChildren, QueryList, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

export interface DataTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  template?: TemplateRef<unknown>;
}

@Component({
  selector: 'innait-data-table',
  standalone: true,
  imports: [CommonModule, TableModule, InputTextModule, ButtonModule],
  template: `
    <p-table
      [value]="data"
      [paginator]="paginator"
      [rows]="rows"
      [totalRecords]="totalRecords"
      [lazy]="lazy"
      [loading]="loading"
      [showCurrentPageReport]="true"
      [rowsPerPageOptions]="[10, 25, 50]"
      currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
      [globalFilterFields]="globalFilterFields"
      (onLazyLoad)="lazyLoad.emit($event)"
      [sortField]="sortField"
      [sortOrder]="sortOrder"
      styleClass="p-datatable-sm p-datatable-striped"
    >
      <ng-template pTemplate="header">
        <tr>
          <th *ngFor="let col of columns" [pSortableColumn]="col.sortable ? col.field : undefined" [style.width]="col.width">
            {{ col.header }}
            <p-sortIcon *ngIf="col.sortable" [field]="col.field" />
          </th>
          <th *ngIf="showActions" style="width: 100px">Actions</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-row>
        <tr>
          <td *ngFor="let col of columns">{{ row[col.field] }}</td>
          <td *ngIf="showActions">
            <ng-content select="[actions]" />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="columns.length + (showActions ? 1 : 0)" class="text-center">{{ emptyMessage }}</td></tr>
      </ng-template>
    </p-table>
  `,
})
export class DataTableComponent {
  @Input() data: unknown[] = [];
  @Input() columns: DataTableColumn[] = [];
  @Input() paginator = true;
  @Input() rows = 10;
  @Input() totalRecords = 0;
  @Input() lazy = false;
  @Input() loading = false;
  @Input() globalFilterFields: string[] = [];
  @Input() sortField = '';
  @Input() sortOrder = 1;
  @Input() showActions = false;
  @Input() emptyMessage = 'No records found';
  @Output() lazyLoad = new EventEmitter<unknown>();
}
