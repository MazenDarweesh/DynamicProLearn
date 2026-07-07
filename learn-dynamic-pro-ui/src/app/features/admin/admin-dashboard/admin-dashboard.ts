import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService, AdminModuleDto } from '../../../core/services/admin.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <div>
          <h2>Enterprise Administration</h2>
          <p class="subtitle">Manage content, users, and organization structure</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn-secondary" (click)="goTo('admin/users')">Users</button>
          <button class="btn-secondary" (click)="goTo('admin/content')">Content</button>
          <button class="btn-secondary" (click)="goTo('admin/assignments')">Assignments</button>
          <button class="btn-danger" (click)="logout()">Logout</button>
        </div>
      </header>
      
      <!-- Summary Cards -->
      <div class="grid stats-grid">
        <div class="card stat-card">
          <div class="stat-icon bg-blue"></div>
          <div class="stat-content">
            <h3>{{ modules.length }}</h3>
            <p>Total Modules</p>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-orange"></div>
          <div class="stat-content">
            <h3>1</h3>
            <p>Active Companies</p>
          </div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon bg-navy"></div>
          <div class="stat-content">
            <h3>1</h3>
            <p>Active Users</p>
          </div>
        </div>
      </div>

      <div class="content-section">
        <div class="section-header">
          <h3>Content Modules</h3>
          <button class="btn-primary" (click)="notImplemented('Create Module')">+ Create Module</button>
        </div>
        
        <div class="card table-card">
          <div *ngIf="isLoading" class="loading">Loading content modules...</div>
          
          <table class="data-table" *ngIf="!isLoading && modules.length > 0">
            <thead>
              <tr>
                <th>Module Name</th>
                <th>Description</th>
                <th>Units</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let mod of modules">
                <td class="fw-500">{{ mod.name }}</td>
                <td class="text-secondary truncate">{{ mod.description }}</td>
                <td><span class="badge badge-light">{{ mod.totalUnits }} Units</span></td>
                <td>
                  <span class="badge" [class.badge-success]="mod.isPublished" [class.badge-warning]="!mod.isPublished">
                    {{ mod.isPublished ? 'Published' : 'Draft' }}
                  </span>
                </td>
                <td class="actions">
                  <button class="btn-icon" (click)="notImplemented('Edit Module')">Edit</button>
                  <button class="btn-icon text-danger" (click)="notImplemented('Delete Module')">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <div *ngIf="!isLoading && modules.length === 0" class="empty-state">
            No modules found. Start building your curriculum!
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h2 { margin-bottom: 5px; font-size: 28px; }
    .subtitle { color: var(--color-text-secondary); margin: 0; }
    
    .grid { display: grid; gap: 20px; }
    .stats-grid { grid-template-columns: repeat(3, 1fr); margin-bottom: 40px; }
    
    .stat-card { display: flex; align-items: center; padding: 24px; gap: 20px; }
    .stat-icon { width: 50px; height: 50px; border-radius: 12px; }
    .bg-blue { background-color: var(--color-primary-light); }
    .bg-orange { background-color: var(--color-accent-light); }
    .bg-navy { background-color: #E2E8F0; } /* Light gray */
    
    .stat-content h3 { margin: 0 0 4px 0; font-size: 24px; }
    .stat-content p { margin: 0; color: var(--color-text-secondary); font-size: 14px; }
    
    .content-section { margin-top: 20px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .section-header h3 { margin: 0; }
    
    .table-card { padding: 0; overflow: hidden; }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; }
    .data-table th, .data-table td { padding: 16px 24px; border-bottom: 1px solid var(--color-border); }
    .data-table th { background-color: var(--color-bg-page); color: var(--color-text-secondary); font-weight: 500; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover { background-color: var(--color-bg-page); }
    
    .truncate { max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fw-500 { font-weight: 500; color: var(--color-navy); }
    .text-secondary { color: var(--color-text-secondary); font-size: 14px; }
    .text-danger { color: var(--color-danger); }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-light { background: #F1F5F9; color: var(--color-text-secondary); }
    .badge-success { background: #E6F4EA; color: #137333; }
    .badge-warning { background: var(--color-accent-light); color: var(--color-accent); }
    
    .actions { display: flex; gap: 10px; }
    
    .loading, .empty-state { padding: 40px; text-align: center; color: var(--color-text-secondary); }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private adminService = inject(AdminService);
  private router = inject(Router);

  modules: AdminModuleDto[] = [];
  isLoading = true;

  ngOnInit() {
    this.adminService.getModules().subscribe({
      next: (data) => {
        this.modules = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load admin modules', err);
        // Fallback for demo if API fails
        this.modules = [];
        this.isLoading = false;
      }
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  goTo(path: string) {
    this.router.navigate([`/${path}`]);
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
