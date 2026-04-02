import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dashboard-container">
      <h1>InnaIT WIAM</h1>
      <p>Self Service Dashboard - Placeholder</p>
    </div>
  `,
  styles: [`.dashboard-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }`],
})
export class DashboardComponent {}
