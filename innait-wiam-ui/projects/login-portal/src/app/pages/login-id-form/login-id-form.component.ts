import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '@innait/core';
import { LoginLayoutComponent } from '../../shared/login-layout/login-layout.component';
import { TranslatePipe } from '@innait/i18n';

@Component({
  selector: 'app-login-id-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, ButtonModule, LoginLayoutComponent, TranslatePipe],
  template: `
    <app-login-layout [title]="'auth.login' | translate" [subtitle]="'auth.enterLoginId' | translate">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" role="form" aria-label="Login identification">
        <div class="field">
          <label for="loginId" class="block mb-2 font-medium">{{ 'auth.loginId' | translate }}</label>
          <input
            id="loginId"
            pInputText
            formControlName="loginId"
            [placeholder]="'auth.enterLoginId' | translate"
            class="w-full"
            autocomplete="username"
            autofocus
            aria-required="true"
            [attr.aria-invalid]="form.get('loginId')?.invalid && form.get('loginId')?.touched"
          />
          <small class="p-error block mt-1" *ngIf="form.get('loginId')?.touched && form.get('loginId')?.hasError('required')">
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
        />
        <p *ngIf="errorMessage" class="p-error mt-2 text-center" role="alert">{{ errorMessage }}</p>
      </form>
    </app-login-layout>
  `,
  styles: [`.field { margin-bottom: 1rem; }`],
})
export class LoginIdFormComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      loginId: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    const loginId: string = this.form.get('loginId')?.value?.trim();

    this.authService.login(loginId).subscribe({
      next: (response) => {
        this.loading = false;
        const methods = response.availableMethods ?? [];

        // Navigate to the first available primary method
        if (methods.includes('PASSWORD')) {
          this.router.navigate(['/login/password']);
        } else if (methods.includes('FIDO')) {
          this.router.navigate(['/login/fido']);
        } else {
          this.router.navigate(['/login/error']);
        }
      },
      error: () => {
        this.loading = false;
        // Timing-safe: never reveal if login ID exists
        this.errorMessage = 'Unable to proceed. Please check your login ID and try again.';
      },
    });
  }
}
