import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService, ModuleDto } from '../../../core/services/student.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <div>
          <h2>Student Learning Portal</h2>
          <p class="subtitle">Pick up where you left off</p>
        </div>
        <button class="btn-primary" (click)="logout()">Logout</button>
      </header>
      
      <div class="content">
        <h3 class="section-title">Your Assigned Modules</h3>
        
        <div *ngIf="isLoading" class="loading">Loading your modules...</div>
        
        <div *ngIf="!isLoading && modules.length === 0" class="empty-state">
          No modules assigned to your department yet.
        </div>
        
        <div class="grid">
          <div class="card module-card" *ngFor="let mod of modules">
            <div class="card-body">
              <div class="badge">Module</div>
              <h4 class="module-title">{{ mod.name }}</h4>
              <p class="module-desc">{{ mod.description }}</p>
              
              <div class="progress-track">
                <div class="progress-fill" style="width: 0%;"></div>
              </div>
              <span class="progress-text">0% Complete</span>
            </div>
            <div class="card-footer">
              <button class="btn-primary w-100" (click)="openLesson(mod.id)">Start Learning</button>
            </div>
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
    .section-title { margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid var(--color-border); padding-bottom: 10px; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
    
    .module-card { display: flex; flex-direction: column; height: 100%; transition: transform 0.2s, box-shadow 0.2s; padding: 0; overflow: hidden; }
    .module-card:hover { transform: translateY(-4px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }
    
    .card-body { padding: 24px; flex-grow: 1; }
    .card-footer { padding: 20px 24px; background-color: var(--color-bg-page); border-top: 1px solid var(--color-border); }
    
    .badge { background: var(--color-primary-light); color: var(--color-primary); padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    .module-title { font-size: 18px; margin-bottom: 10px; line-height: 1.4; }
    .module-desc { color: var(--color-text-secondary); font-size: 14px; margin-bottom: 20px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    
    .progress-track { height: 6px; background: var(--color-border); border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
    .progress-fill { height: 100%; background: var(--color-primary); }
    .progress-text { font-size: 12px; color: var(--color-text-secondary); font-weight: 500; }
    
    .w-100 { width: 100%; }
    .loading, .empty-state { padding: 40px; text-align: center; color: var(--color-text-secondary); font-size: 16px; background: var(--color-bg-card); border-radius: var(--radius-card); border: 1px dashed var(--color-border); }
  `]
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private studentService = inject(StudentService);
  private router = inject(Router);

  modules: ModuleDto[] = [];
  isLoading = true;

  ngOnInit() {
    this.studentService.getAssignedModules().subscribe({
      next: (data) => {
        this.modules = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load modules', err);
        // Mock data fallback just for demo
        this.modules = [
          { id: 'm1', name: 'Intro to DynamicPro ERP', description: 'Learn the fundamentals of our enterprise system.' },
          { id: 'm2', name: 'Financial Accounting', description: 'Master the GL, AP, and AR modules.' }
        ];
        this.isLoading = false;
      }
    });
  }

  openLesson(moduleId: string) {
    this.router.navigate(['/student/lesson', moduleId]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
