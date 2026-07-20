import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { EvaluationsDashboardComponent } from '../../../shared/components/evaluations-dashboard/evaluations-dashboard.component';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-admin-version-details',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, EvaluationsDashboardComponent],
  templateUrl: './admin-version-details.component.html'
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
    if (!this.versionDetails || !this.versionDetails.testers) return;
    
    this.totalLessonsCount = 0;
    this.completedLessonsCount = 0;

    this.formattedTesters = this.versionDetails.testers.map((t: any) => {
      return {
        groupName: t.testerName,
        modules: (t.modules || []).map((m: any) => {
          
          let mTotal = 0;
          let mCompleted = 0;

          const lessons = (m.lessons || []).map((l: any) => {
            const isCompleted = l.conditionLabel && l.conditionLabel !== 'غير مختبر';
            this.totalLessonsCount++;
            mTotal++;
            if (isCompleted) {
              this.completedLessonsCount++;
              mCompleted++;
            }

            return {
              title: l.lessonTitle,
              status: l.conditionLabel || 'غير مختبر',
              comment: l.notes,
              evaluationDate: l.feedbackDate
            };
          });

          return {
            name: m.moduleName,
            totalLessons: mTotal,
            completedLessons: mCompleted,
            units: [
              {
                name: 'دروس الموديول',
                lessons: lessons
              }
            ]
          };
        })
      };
    });
    
    this.uniqueTesters = this.formattedTesters.map(t => t.groupName);
  }
}
