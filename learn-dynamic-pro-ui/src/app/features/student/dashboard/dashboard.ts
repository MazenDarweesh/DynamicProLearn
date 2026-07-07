import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <h2>Student Dashboard</h2>
        <button class="btn-primary" (click)="logout()">Logout</button>
      </header>
      
      <div class="content">
        <div class="card">
          <h3>Welcome, Student!</h3>
          <p>This is your personalized learning dashboard.</p>
          <div class="module-placeholder">
            <div class="badge">Module 1</div>
            <p>Introduction to DynamicPro ERP</p>
            <div class="progress-track">
              <div class="progress-fill" style="width: 45%;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 30px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .module-placeholder { margin-top: 20px; padding: 20px; border: 1px solid var(--color-border); border-radius: 8px; }
    .badge { background: var(--color-primary-light); color: var(--color-primary); padding: 4px 8px; border-radius: 4px; display: inline-block; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
    .progress-track { height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden; margin-top: 15px; }
    .progress-fill { height: 100%; background: var(--color-primary); }
  `]
})
export class DashboardComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
