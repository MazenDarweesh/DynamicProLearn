import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService, ModuleDto } from '../../../core/services/student.service';
import { Router } from '@angular/router';

export interface DashboardModule extends ModuleDto {
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
}

import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';

@Component({
  selector: 'app-tester-dashboard',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent, AdminHeaderComponent],
  templateUrl: './tester-dashboard.component.html',
  styleUrl: './tester-dashboard.component.css'
})
export class TesterDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private studentService = inject(StudentService);
  private router = inject(Router);

  modules: DashboardModule[] = [];
  isLoading = true;

  ngOnInit() {
    // Fetch modules and progress concurrently
    Promise.all([
      this.studentService.getAssignedModules().toPromise(),
      this.studentService.getProgress().toPromise().catch(() => null)
    ]).then(([modulesData, progressData]) => {
      
      const mods = modulesData || [];
      const progressMap = new Map<string, any>();
      
      if (progressData && progressData.modulesProgress) {
        progressData.modulesProgress.forEach((p: any) => {
          progressMap.set(p.moduleId, p);
        });
      }

      this.modules = mods.map(m => {
        let percent = 0;
        let completed = 0;
        let total = 0;
        const prog = progressMap.get(m.id);
        if (prog) {
          completed = prog.completedLessons || 0;
          total = prog.totalLessons || 0;
          if (total > 0) {
            percent = Math.round((completed / total) * 100);
          }
        }
        return {
          ...m,
          progressPercent: percent,
          completedLessons: completed,
          totalLessons: total
        };
      });
      
    }).catch(err => {
      console.error('Failed to load dashboard data', err);
      // Fallback
      this.modules = [];
    }).finally(() => {
      this.isLoading = false;
    });
  }

  openLesson(moduleId: string) {
    this.router.navigate(['/tester/feedback'], { queryParams: { moduleId } });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
