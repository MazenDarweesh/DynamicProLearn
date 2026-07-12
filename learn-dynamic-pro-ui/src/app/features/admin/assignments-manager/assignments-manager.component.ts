import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';

@Component({
  selector: 'app-assignments-manager',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent],
  template: `
    <app-admin-header></app-admin-header>
    <div class="dashboard-container" dir="rtl">
      <div class="d-flex justify-between w-100 mt-2 mb-4">
        <h2>تحليلات النظام</h2>
        <button class="btn-primary" (click)="assignNewModule()">Assign New Module</button>
      </div>

      <div class="grid">
        <div class="card assignment-card">
          <div class="card-header">
            <h4>Intro to DynamicPro</h4>
            <span class="badge badge-primary">Level 1</span>
          </div>
          <div class="assignment-meta mt-2">
            <p><strong>Department:</strong> HR & Payroll</p>
            <p><strong>Required Type:</strong> Mandatory</p>
          </div>
          <div class="actions mt-3">
            <button class="btn-secondary w-100" (click)="notImplemented('Edit Rule')">Edit Rule</button>
          </div>
        </div>

        <div class="card assignment-card">
          <div class="card-header">
            <h4>Financial Accounting</h4>
            <span class="badge badge-primary">Level 2</span>
          </div>
          <div class="assignment-meta mt-2">
            <p><strong>Department:</strong> Accounting</p>
            <p><strong>Required Type:</strong> Elective</p>
          </div>
          <div class="actions mt-3">
            <button class="btn-secondary w-100" (click)="notImplemented('Edit Rule')">Edit Rule</button>
          </div>
        </div>
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
    .mt-3 { margin-top: 15px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; }
    
    .assignment-card { padding: 25px; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-header h4 { margin: 0; font-size: 18px; }
    
    .assignment-meta p { margin: 5px 0; color: var(--color-text-secondary); font-size: 14px; }
    .assignment-meta strong { color: var(--color-text-primary); }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-primary { background: var(--color-primary-light); color: var(--color-primary); }
  `]
})
export class AssignmentsManagerComponent {
  private router = inject(Router);
  private adminService = inject(AdminService);
  
  goBack() {
    this.router.navigate(['/admin']);
  }

  assignNewModule() {
    const moduleId = prompt('Enter Module ID to assign:');
    if (!moduleId) return;
    const deptId = prompt('Enter Department ID:');
    if (!deptId) return;

    this.adminService.assignModule(moduleId, deptId).subscribe({
      next: () => alert('Module assigned to department successfully!'),
      error: (err) => alert('Failed to assign module: ' + (err.error?.detail || err.message))
    });
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
