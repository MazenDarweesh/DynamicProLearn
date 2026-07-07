import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService, UnitDto } from '../../../core/services/student.service';

@Component({
  selector: 'app-lesson-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="viewer-container">
      <header class="viewer-header">
        <button class="btn-back" (click)="goBack()">← Back to Dashboard</button>
        <h3>Module Lessons</h3>
      </header>
      
      <div class="viewer-content">
        <!-- Sidebar -->
        <div class="viewer-sidebar card">
          <div *ngIf="isLoading" class="text-secondary">Loading units...</div>
          <div *ngIf="!isLoading && units.length === 0" class="text-secondary">No units found.</div>
          
          <div class="unit" *ngFor="let unit of units">
            <h4>{{ unit.title }}</h4>
            <div class="lesson active">Lesson 1: Introduction</div>
          </div>
        </div>
        
        <!-- Main Area -->
        <div class="viewer-main">
          <div class="video-placeholder">
            <div class="play-icon">▶</div>
          </div>
          
          <div class="lesson-details card mt-3">
            <div class="badge">Video Lecture</div>
            <h2>Lesson 1: Introduction</h2>
            <p class="text-secondary">Learn the fundamental concepts of this unit.</p>
            
            <button class="btn-primary mt-3" (click)="notImplemented('Mark as Completed')">Mark as Completed</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .viewer-container { padding: 20px; max-width: 1400px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; }
    .viewer-header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--color-border); }
    
    .viewer-content { display: flex; gap: 30px; flex: 1; min-height: 0; }
    
    .viewer-sidebar { width: 300px; overflow-y: auto; padding: 20px; }
    .unit h4 { font-size: 14px; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
    .lesson { padding: 12px 15px; border-radius: 8px; cursor: pointer; margin-bottom: 5px; font-size: 15px; }
    .lesson:hover { background-color: var(--color-bg-page); }
    .lesson.active { background-color: var(--color-primary-light); color: var(--color-primary); font-weight: 500; }
    
    .viewer-main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
    .video-placeholder { background-color: var(--color-bg-video); aspect-ratio: 16/9; border-radius: var(--radius-card); display: flex; align-items: center; justify-content: center; }
    .play-icon { font-size: 48px; color: rgba(255,255,255,0.8); cursor: pointer; }
    .play-icon:hover { color: white; transform: scale(1.1); transition: 0.2s; }
    
    .lesson-details { padding: 30px; }
    .badge { background: var(--color-accent-light); color: var(--color-accent); padding: 4px 10px; border-radius: 6px; display: inline-block; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    .text-secondary { color: var(--color-text-secondary); line-height: 1.6; }
    .mt-3 { margin-top: 20px; }
  `]
})
export class LessonViewer implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private studentService = inject(StudentService);
  
  units: UnitDto[] = [];
  isLoading = true;

  ngOnInit() {
    const moduleId = this.route.snapshot.paramMap.get('id');
    if (moduleId) {
      this.studentService.getModuleUnits(moduleId).subscribe({
        next: (data) => {
          this.units = data;
          this.isLoading = false;
        },
        error: () => this.isLoading = false
      });
    }
  }

  goBack() {
    this.router.navigate(['/student']);
  }

  notImplemented(feature: string) {
    alert(`[UI Demo] The '${feature}' feature will be connected to the backend soon!`);
  }
}
