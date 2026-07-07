import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService, CompanyDto } from '../../../core/services/admin.service';

@Component({
  selector: 'app-users-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        <div class="d-flex justify-between w-100 mt-2">
          <h2>Companies Management</h2>
          <button class="btn-primary" (click)="addNewCompany()">+ Add New Company</button>
        </div>
      </header>

      <div class="card">
        <div class="filters">
          <input type="text" class="form-control search" placeholder="Search companies...">
        </div>

        <table class="data-table mt-4">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Industry</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="isLoading"><td colspan="4" class="text-center">Loading companies...</td></tr>
            <tr *ngFor="let comp of companies">
              <td class="fw-500">{{ comp.name }}</td>
              <td class="text-secondary">{{ comp.industry }}</td>
              <td><span class="badge badge-success">Active</span></td>
              <td class="actions">
                <button class="btn-icon" (click)="notImplemented('Edit Company')">Edit</button>
              </td>
            </tr>
            <tr *ngIf="!isLoading && companies.length === 0"><td colspan="4" class="text-center text-secondary">No companies found.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
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
    .text-center { text-align: center; }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-success { background: #E6F4EA; color: #137333; }
    
    .actions { display: flex; gap: 10px; }
  `]
})
export class UsersManagerComponent implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  
  companies: CompanyDto[] = [];
  isLoading = true;

  ngOnInit() {
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  addNewCompany() {
    const name = prompt('Enter New Company Name:');
    if (!name) return;
    
    this.adminService.createCompany(name).subscribe({
      next: () => {
        alert('Company added successfully!');
        this.ngOnInit(); // reload list
      },
      error: (err) => alert('Failed to add company: ' + (err.error?.detail || err.message))
    });
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
