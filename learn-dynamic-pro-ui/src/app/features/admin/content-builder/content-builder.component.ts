import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-content-builder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        <div class="d-flex justify-between w-100 mt-2">
          <h2>Curriculum Content Builder</h2>
          <div class="actions-header">
            <button class="btn-secondary">Drafts</button>
            <button class="btn-primary">+ New Module</button>
          </div>
        </div>
      </header>

      <div class="content grid">
        <div class="sidebar card">
          <h4>Modules</h4>
          <ul class="module-list">
            <li class="active">
              <span class="dot"></span> Intro to DynamicPro
            </li>
            <li>Financial Accounting</li>
            <li>HR Management</li>
          </ul>
        </div>

        <div class="main-builder card">
          <div class="builder-header">
            <h3>Intro to DynamicPro</h3>
            <span class="badge badge-success">Published</span>
          </div>
          <p class="text-secondary mt-1">Learn the fundamentals of our enterprise system.</p>

          <div class="units-container mt-4">
            <div class="unit-box">
              <div class="d-flex justify-between">
                <h4>Unit 1: System Basics</h4>
                <button class="btn-icon">Add Lesson</button>
              </div>
              <div class="lesson-item">
                <span class="icon">🎥</span> Lesson 1.1: What is ERP?
              </div>
              <div class="lesson-item">
                <span class="icon">📄</span> Lesson 1.2: System Architecture
              </div>
            </div>
            
            <button class="btn-dashed mt-3">+ Add Unit</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1300px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
    .btn-back { background: none; border: none; font-family: inherit; font-size: 14px; color: var(--color-text-secondary); cursor: pointer; padding: 0; }
    .btn-back:hover { color: var(--color-primary); }
    .d-flex { display: flex; align-items: center; }
    .justify-between { justify-content: space-between; }
    .w-100 { width: 100%; }
    .mt-1 { margin-top: 5px; }
    .mt-2 { margin-top: 10px; }
    .mt-3 { margin-top: 15px; }
    .mt-4 { margin-top: 25px; }
    
    .actions-header { display: flex; gap: 10px; }
    .btn-secondary { background: var(--color-bg-page); border: 1px solid var(--color-border); padding: 10px 20px; border-radius: var(--radius-btn); cursor: pointer; font-family: inherit; font-weight: 500; }
    
    .grid { display: grid; grid-template-columns: 280px 1fr; gap: 30px; align-items: start; }
    
    .module-list { list-style: none; padding: 0; margin-top: 15px; }
    .module-list li { padding: 12px 15px; border-radius: 8px; cursor: pointer; color: var(--color-text-secondary); display: flex; align-items: center; gap: 10px; }
    .module-list li:hover { background: var(--color-bg-page); }
    .module-list li.active { background: var(--color-primary-light); color: var(--color-primary); font-weight: 500; }
    .dot { width: 8px; height: 8px; background: var(--color-primary); border-radius: 50%; }
    
    .builder-header { display: flex; justify-content: space-between; align-items: center; }
    .builder-header h3 { margin: 0; font-size: 22px; }
    
    .text-secondary { color: var(--color-text-secondary); }
    
    .unit-box { border: 1px solid var(--color-border); padding: 20px; border-radius: 8px; background: var(--color-bg-page); }
    .unit-box h4 { margin: 0 0 15px 0; }
    
    .lesson-item { background: white; padding: 12px 15px; border-radius: 6px; border: 1px solid var(--color-border); margin-bottom: 10px; font-size: 14px; display: flex; align-items: center; gap: 10px; }
    
    .btn-icon { background: none; border: none; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; color: var(--color-primary); }
    .btn-dashed { width: 100%; padding: 15px; background: none; border: 2px dashed var(--color-border); border-radius: 8px; color: var(--color-text-secondary); font-family: inherit; font-weight: 500; cursor: pointer; }
    .btn-dashed:hover { border-color: var(--color-primary); color: var(--color-primary); }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-success { background: #E6F4EA; color: #137333; }
  `]
})
export class ContentBuilderComponent {
  private router = inject(Router);
  
  goBack() {
    this.router.navigate(['/admin']);
  }
}
