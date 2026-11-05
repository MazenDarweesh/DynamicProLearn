import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/platform-core/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { EvaluationsDashboardComponent } from '../../../shared/components/evaluations-dashboard/evaluations-dashboard.component';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-admin-version-details',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, EvaluationsDashboardComponent],
  templateUrl: './admin-version-details.component.html',
  styleUrls: ['./admin-version-details.component.css']
})
export class AdminVersionDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);

  versionId = '';
  versionDetails: any = null;
  isLoading = true;
  
  formattedTesters: any[] = [];
  uniqueTesters: string[] = [];
  completedLessonsCount = 0;
  totalLessonsCount = 0;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.versionId = params.get('id') || '';
      if (this.versionId) {
        this.loadVersionDetails();
      } else {
        this.router.navigate(['/admin/testers']);
      }
    });
  }

  loadVersionDetails(): void {
    this.isLoading = true;
    this.adminService.getVersionProgress(this.versionId).subscribe({
      next: (res) => {
        this.versionDetails = res;
        this.formatProgressData();
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('حدث خطأ أثناء تحميل بيانات الإصدار', 'خطأ', 'error');
        this.isLoading = false;
        this.router.navigate(['/admin/testers']);
      }
    });
  }

  formatProgressData(): void {
    const testers = this.versionDetails?.testers || this.versionDetails?.Testers;
    if (!testers) return;

    this.totalLessonsCount = 0;
    this.completedLessonsCount = 0;

    this.formattedTesters = testers.map((t: any) => {
      const testerName = t.testerName || t.TesterName || 'مختبر مجهول';
      const modules = t.modules || t.Modules || [];

      return {
        groupName: testerName,
        modules: modules.map((m: any) => {
          const moduleName = m.moduleName || m.ModuleName || 'موديول';
          const lessons = m.lessons || m.Lessons || [];

          let mTotal = 0;
          let mCompleted = 0;

          const mappedLessons = lessons.map((l: any) => {
            const conditionLabel = l.conditionLabel || l.ConditionLabel;
            const isCompleted = conditionLabel && conditionLabel !== 'غير مختبر';
            this.totalLessonsCount++;
            mTotal++;
            if (isCompleted) {
              this.completedLessonsCount++;
              mCompleted++;
            }

            return {
              lessonId: l.lessonId || l.LessonId,
              name: l.lessonTitle || l.LessonTitle || l.title || l.Title || l.name || '',
              title: l.lessonTitle || l.LessonTitle || l.title || l.Title || l.name || '',
              status: conditionLabel || 'غير مختبر',
              comment: l.notes || l.Notes,
              evaluationDate: l.feedbackDate || l.FeedbackDate
            };
          });

          return {
            moduleId: m.moduleId || m.ModuleId,
            name: moduleName,
            totalLessons: mTotal,
            completedLessons: mCompleted,
            units: [
              {
                unitId: `unit_${moduleName}_${testerName}`,
                name: moduleName,
                lessons: mappedLessons
              }
            ]
          };
        })
      };
    });

    this.uniqueTesters = this.formattedTesters.map((t: any) => t.groupName);
  }
}
