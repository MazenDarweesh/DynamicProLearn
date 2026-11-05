import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../../../core/services/platform-core/admin.service';
import { AdminHeaderComponent } from '../../../../shared/components/admin-header/admin-header.component';
import { CurriculumViewerComponent } from '../../../../shared/components/curriculum-viewer/curriculum-viewer.component';
import { ModuleAnalyticsDto } from '../../../../core/models/analytics.models';

@Component({
  selector: 'app-lessons-analytics',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, CurriculumViewerComponent],
  templateUrl: './lessons-analytics.component.html',
  styleUrls: ['./lessons-analytics.component.css']
})
export class LessonsAnalyticsComponent implements OnInit {
  private adminService = inject(AdminService);
  private router = inject(Router);

  modules: ModuleAnalyticsDto[] = [];
  isLoading = true;
  isAllExpanded = false;

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.isLoading = true;
    this.adminService.getCurriculumAnalytics().subscribe({
      next: (res) => {
        // Compute additional progress for progress bars in the curriculum viewer
        this.modules = res.map(m => {
          let totalLessons = 0;
          let completedLessons = 0;
          
          m.units.forEach((u: any) => {
            totalLessons += u.lessons.length;
            u.lessons.forEach((l: any) => {
              if (l.completedStudentsCount > 0 && l.completedStudentsCount === l.enrolledStudentsCount) {
                completedLessons++;
              }
            });
          });

          return {
            ...m,
            totalLessons,
            completedLessons
          };
        });
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  toggleExpandAll(): void {
    this.isAllExpanded = !this.isAllExpanded;
  }

  navigateToLessonDetails(lessonId: string): void {
    this.router.navigate(['/admin/analytics/lesson', lessonId]);
  }
}
