import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-users-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        <div class="d-flex justify-between w-100 mt-2">
          <h2>Users & Roles Management</h2>
          <button class="btn-primary" (click)="notImplemented('Add New User')">+ Add New User</button>
        </div>
      </header>

      <div class="card">
        <div class="filters">
          <input type="text" class="form-control search" placeholder="Search users...">
          <select class="form-control">
            <option>All Roles</option>
            <option>Admin</option>
            <option>Student</option>
            <option>Tester</option>
          </select>
        </div>

        <table class="data-table mt-4">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Company / Dept</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="fw-500">Mazen Admin</td>
              <td><span class="badge badge-primary">Admin</span></td>
              <td class="text-secondary">DynamicPro (HQ)</td>
              <td><span class="badge badge-success">Active</span></td>
              <td class="actions">
                <button class="btn-icon" (click)="notImplemented('Edit User')">Edit</button>
              </td>
            </tr>
            <tr>
              <td class="fw-500">Ahmed Student</td>
              <td><span class="badge badge-light">Student</span></td>
              <td class="text-secondary">DynamicPro (Sales)</td>
              <td><span class="badge badge-success">Active</span></td>
              <td class="actions">
                <button class="btn-icon" (click)="notImplemented('Edit User')">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
    .btn-back { background: none; border: none; font-family: inherit; font-size: 14px; color: var(--color-text-secondary); cursor: pointer; padding: 0; }
    .btn-back:hover { color: var(--color-primary); }
    .d-flex { display: flex; align-items: center; }
    .justify-between { justify-content: space-between; }
    .w-100 { width: 100%; }
    .mt-2 { margin-top: 10px; }
    .mt-4 { margin-top: 20px; }
    
    .filters { display: flex; gap: 15px; }
    .form-control { padding: 10px 15px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background-color: var(--color-bg-page); color: var(--color-text-primary); font-family: inherit; }
    .search { flex: 1; }
    
    .data-table { width: 100%; border-collapse: collapse; text-align: left; }
    .data-table th, .data-table td { padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
    .data-table th { background-color: var(--color-bg-page); color: var(--color-text-secondary); font-weight: 500; font-size: 13px; text-transform: uppercase; }
    .data-table tbody tr:hover { background-color: var(--color-bg-page); }
    
    .fw-500 { font-weight: 500; }
    .text-secondary { color: var(--color-text-secondary); font-size: 14px; }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-primary { background: var(--color-primary-light); color: var(--color-primary); }
    .badge-light { background: #E2E8F0; color: var(--color-navy); }
    .badge-success { background: #E6F4EA; color: #137333; }
    
    .actions { display: flex; gap: 10px; }
  `]
})
export class UsersManagerComponent {
  private router = inject(Router);
  
  goBack() {
    this.router.navigate(['/admin']);
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
