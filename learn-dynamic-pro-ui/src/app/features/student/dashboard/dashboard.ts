import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService, ModuleDto, LessonDetailDto } from '../../../core/services/student.service';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Dialog } from '../../../core/utils/dialog';

export interface DashboardModule extends ModuleDto {
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
}

import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { ContinueLearningComponent } from '../continue-learning/continue-learning.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, ProgressBarComponent, ContinueLearningComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private studentService = inject(StudentService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  modules: DashboardModule[] = [];
  isLoading = true;

  activeTab: 'resume' | 'browse' = 'resume';

  lastLesson: LessonDetailDto | null = null;
  safeVideoUrl: SafeResourceUrl | null = null;
  levelGroups: any[] = [];
  isSubmitting = false;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'] as 'resume' | 'browse';
      }
    });

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
      this.modules = [];
    });

    this.loadLastLessonData();
  }

  loadLastLessonData() {
    this.studentService.getLastLesson().subscribe({
      next: (res: any) => {
        if (res && res.lessonId) {
          const san = inject(DomSanitizer);
          this.studentService.getLessonDetail(res.lessonId).subscribe(detail => {
            this.lastLesson = detail;
            if (detail.videoUrl) {
              let url = detail.videoUrl;
              // robust check for youtube
              const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
              if (ytMatch && ytMatch[1]) {
                url = `https://www.youtube.com/embed/${ytMatch[1]}`;
              }
              this.safeVideoUrl = san.bypassSecurityTrustResourceUrl(url);
            }
          });

          this.studentService.getLessonsByLevel(res.moduleId).subscribe(levels => {
            this.levelGroups = levels;
          });
        } else {
          // No last lesson, default to browse tab
          this.activeTab = 'browse';
          this.isLoading = false;
        }
      },
      error: () => {
        this.activeTab = 'browse';
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  switchTab(tab: 'resume' | 'browse') {
    this.activeTab = tab;
  }

  loadSpecificLesson(lessonId: string, moduleId: string) {
    const san = inject(DomSanitizer);
    this.studentService.getLessonDetail(lessonId).subscribe(detail => {
      this.lastLesson = detail;
      if (detail.videoUrl) {
        let url = detail.videoUrl;
        // robust check for youtube
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        if (ytMatch && ytMatch[1]) {
          url = `https://www.youtube.com/embed/${ytMatch[1]}`;
        }
        this.safeVideoUrl = san.bypassSecurityTrustResourceUrl(url);
      }
    });
  }

  toggleCompletion() {
    if (!this.lastLesson) return;
    
    this.isSubmitting = true;
    const newStatus = !this.lastLesson.isCompleted;

    this.studentService.completeLesson(this.lastLesson.id, newStatus).subscribe({
      next: () => {
        this.lastLesson!.isCompleted = newStatus;
        // Also update in levelGroups tree
        this.levelGroups.forEach(g => {
          const l = g.lessons.find((x: any) => x.id === this.lastLesson?.id);
          if (l) l.isCompleted = newStatus;
        });
        this.isSubmitting = false;
      },
      error: (err: any) => {
        Dialog.alert('فشل في تحديث حالة الدرس.', 'خطأ', 'error');
        this.isSubmitting = false;
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
