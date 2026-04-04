import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemingService, ThemeMode } from '@innait/core';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'innait-dark-mode-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="dark-mode-toggle"
      (click)="cycle()"
      [attr.aria-label]="'Theme: ' + currentMode"
      [title]="'Theme: ' + currentMode">
      <i class="pi" [ngClass]="{
        'pi-sun': currentMode === 'light',
        'pi-moon': currentMode === 'dark',
        'pi-desktop': currentMode === 'system'
      }"></i>
    </button>
  `,
  styles: [`
    .dark-mode-toggle {
      background: none;
      border: 1px solid var(--innait-text-secondary, #999);
      border-radius: 6px;
      padding: 0.375rem 0.625rem;
      cursor: pointer;
      color: var(--innait-text, #333);
      font-size: 1rem;
      display: flex;
      align-items: center;
      transition: all 0.15s ease;
    }
    .dark-mode-toggle:hover {
      border-color: var(--innait-primary);
      color: var(--innait-primary);
      background: var(--innait-bg);
    }
  `],
})
export class DarkModeToggleComponent implements OnDestroy {
  currentMode: ThemeMode = 'system';
  private readonly destroy$ = new Subject<void>();
  private readonly modes: ThemeMode[] = ['light', 'dark', 'system'];

  constructor(private readonly theming: ThemingService) {
    this.theming.themeMode.pipe(takeUntil(this.destroy$)).subscribe((m) => {
      this.currentMode = m;
    });
  }

  cycle(): void {
    const idx = this.modes.indexOf(this.currentMode);
    const next = this.modes[(idx + 1) % this.modes.length]!;
    this.theming.setMode(next);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
