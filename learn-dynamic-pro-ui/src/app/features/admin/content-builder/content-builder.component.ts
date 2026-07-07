import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService, AdminModuleDto } from '../../../core/services/admin.service';

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
            <button class="btn-secondary" (click)="notImplemented('View Drafts')">Drafts</button>
            <button class="btn-primary" (click)="createNewModule()">+ New Module</button>
          </div>
        </div>
      </header>

      <div class="content grid">
        <div class="sidebar card">
          <h4>Modules</h4>
          <div *ngIf="isLoading" class="text-secondary mt-2">Loading...</div>
          <ul class="module-list" *ngIf="!isLoading">
            <li *ngFor="let mod of modules" [class.active]="selectedModule?.id === mod.id" (click)="selectModule(mod)">
              <span class="dot" *ngIf="selectedModule?.id === mod.id"></span> {{ mod.name }}
            </li>
          </ul>
        </div>

        <div class="main-builder card" *ngIf="selectedModule">
          <div class="builder-header">
            <h3>{{ selectedModule.name }}</h3>
            <span class="badge" [class.badge-success]="selectedModule.isPublished">{{ selectedModule.isPublished ? 'Published' : 'Draft' }}</span>
          </div>
          <p class="text-secondary mt-1">{{ selectedModule.description }}</p>

          <div class="units-container mt-4">
            <div class="unit-box">
              <div class="d-flex justify-between">
                <h4>Unit 1: System Basics</h4>
                <button class="btn-icon" (click)="notImplemented('Add Lesson')">Add Lesson</button>
              </div>
              <div class="lesson-item">
                <span class="icon">🎥</span> Lesson 1.1: What is ERP?
              </div>
              <div class="lesson-item">
                <span class="icon">📄</span> Lesson 1.2: System Architecture
              </div>
            </div>
            
            <button class="btn-dashed mt-3" (click)="notImplemented('Add Unit')">+ Add Unit</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 40px; max-width: 1300px; margin: 0 auto; }
    .header { margin-bottom: 30px; }
    .d-flex { display: flex; align-items: center; }
    .justify-between { justify-content: space-between; }
    .w-100 { width: 100%; }
    .mt-1 { margin-top: 5px; }
    .mt-2 { margin-top: 10px; }
    .mt-3 { margin-top: 15px; }
    .mt-4 { margin-top: 25px; }
    
    .actions-header { display: flex; gap: 10px; }
    
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
    
    .btn-dashed { width: 100%; padding: 15px; background: none; border: 2px dashed var(--color-border); border-radius: 8px; color: var(--color-text-secondary); font-family: inherit; font-weight: 500; cursor: pointer; }
    .btn-dashed:hover { border-color: var(--color-primary); color: var(--color-primary); }
    
    .badge { padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; }
    .badge-success { background: #E6F4EA; color: #137333; }
  `]
})
export class ContentBuilderComponent implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  
  modules: AdminModuleDto[] = [];
  selectedModule: AdminModuleDto | null = null;
  isLoading = true;

  ngOnInit() {
    this.loadModules();
  }

  loadModules() {
    this.adminService.getModules().subscribe({
      next: (data) => {
        this.modules = data;
        if (data.length > 0) this.selectedModule = data[0];
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  selectModule(mod: AdminModuleDto) {
    this.selectedModule = mod;
  }

  createNewModule() {
    const name = prompt('Enter Module Name:');
    if (!name) return;
    const desc = prompt('Enter Module Description:');
    
    this.adminService.createModule(name, desc || '').subscribe({
      next: () => {
        alert('Module Created Successfully!');
        this.loadModules(); // reload
      },
      error: (err) => alert('Failed to create module: ' + (err.error?.detail || err.message))
    });
  }
  
  goBack() {
    this.router.navigate(['/admin']);
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
