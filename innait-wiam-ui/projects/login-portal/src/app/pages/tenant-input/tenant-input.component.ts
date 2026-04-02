import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { TenantService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-tenant-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout title="InnaIT WIAM" [subtitle]="'auth.enterLoginId' | translate">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" role="form" aria-label="Tenant identification">
        <div class="field">
          <label for="emailOrDomain" class="block mb-2 font-medium">{{ 'user.email' | translate }}</label>
          <input
            id="emailOrDomain"
            pInputText
            formControlName="emailOrDomain"
            [placeholder]="'auth.enterLoginId' | translate"
            class="w-full"
            autocomplete="username"
            autofocus
            aria-required="true"
            [attr.aria-invalid]="form.get('emailOrDomain')?.invalid && form.get('emailOrDomain')?.touched"
          />
          <small class="p-error block mt-1" *ngIf="form.get('emailOrDomain')?.touched && form.get('emailOrDomain')?.hasError('required')">
            {{ 'common.required' | translate }}
          </small>
        </div>
        <p-button
          type="submit"
          [label]="'common.next' | translate"
          styleClass="w-full mt-3"
          [disabled]="form.invalid || loading"
          [loading]="loading"
          icon="pi pi-arrow-right"
          iconPos="right"
          aria-label="Continue to login"
        />
        <p *ngIf="errorMessage" class="p-error mt-2 text-center" role="alert">{{ errorMessage }}</p>
      </form>
    </app-login-layout>
  `,
  styles: [`.field { margin-bottom: 1rem; }`],
})
export class TenantInputComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly tenantService: TenantService
  ) {}

  ngOnInit(): void {
    // If tenant already resolved from URL subdomain, skip this screen
    if (this.tenantService.currentTenantId) {
      this.router.navigate(['/login']);
      return;
    }

    this.form = this.fb.group({
      emailOrDomain: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    const input: string = this.form.get('emailOrDomain')?.value?.trim() ?? '';

    // Extract domain from email or use as-is
    let tenantCode: string;
    if (input.includes('@')) {
      const domain = input.split('@')[1];
      tenantCode = domain?.split('.')[0] ?? '';
    } else {
      tenantCode = input;
    }

    if (!tenantCode) {
      this.errorMessage = 'Please enter a valid email or organization domain';
      this.loading = false;
      return;
    }

    this.tenantService.setTenantId(tenantCode);
    this.router.navigate(['/login']);
    this.loading = false;
  }
}
