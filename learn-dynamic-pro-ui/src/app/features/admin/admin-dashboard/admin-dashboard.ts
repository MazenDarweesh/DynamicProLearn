import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <h2>Admin Dashboard</h2>
        <button class="btn-primary" (click)="logout()">Logout</button>
      </header>
      
      <div class="content grid">
        <div class="card">
          <h3>Users & Roles</h3>
          <p>Manage companies, departments, and user roles.</p>
          <button class="btn-primary">Manage</button>
        </div>
        <div class="card">
          <h3>Content Builder</h3>
          <p>Create and edit modules, units, and lessons.</p>
          <button class="btn-primary">Manage</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 30px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card button { margin-top: 15px; width: auto; }
  `]
})
export class AdminDashboardComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
