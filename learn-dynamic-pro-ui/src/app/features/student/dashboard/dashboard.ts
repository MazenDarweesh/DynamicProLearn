import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService, ModuleDto } from '../../../core/services/student.service';
import { Router } from '@angular/router';

export interface DashboardModule extends ModuleDto {
  progressPercent: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
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
        const prog = progressMap.get(m.id);
        if (prog && prog.totalLessons > 0) {
          percent = Math.round((prog.completedLessons / prog.totalLessons) * 100);
        }
        return {
          ...m,
          progressPercent: percent
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
    this.router.navigate(['/student/lesson', moduleId]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
