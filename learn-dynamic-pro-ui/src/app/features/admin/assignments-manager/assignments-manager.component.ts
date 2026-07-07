import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-assignments-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        <div class="d-flex justify-between w-100 mt-2">
          <h2>Department Assignments</h2>
          <button class="btn-primary">Assign New Module</button>
        </div>
      </header>

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
            <button class="btn-secondary w-100">Edit Rule</button>
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
            <button class="btn-secondary w-100">Edit Rule</button>
          </div>
        </div>
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
    .mt-3 { margin-top: 15px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 24px; }
    
    .assignment-card { padding: 25px; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-header h4 { margin: 0; font-size: 18px; }
    
    .assignment-meta p { margin: 5px 0; color: var(--color-text-secondary); font-size: 14px; }
    .assignment-meta strong { color: var(--color-text-primary); }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-primary { background: var(--color-primary-light); color: var(--color-primary); }
    
    .btn-secondary { background: var(--color-bg-page); border: 1px solid var(--color-border); padding: 10px 20px; border-radius: var(--radius-btn); cursor: pointer; font-family: inherit; font-weight: 500; }
    .btn-secondary:hover { background: #f0f0f0; }
  `]
})
export class AssignmentsManagerComponent {
  private router = inject(Router);
  
  goBack() {
    this.router.navigate(['/admin']);
  }
}
