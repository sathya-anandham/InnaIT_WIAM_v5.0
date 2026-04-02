import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <div class="login-container">
      <h1>InnaIT WIAM</h1>
      <p>Login Portal - Placeholder</p>
    </div>
  `,
  styles: [`.login-container { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }`],
})
export class LoginComponent {}
