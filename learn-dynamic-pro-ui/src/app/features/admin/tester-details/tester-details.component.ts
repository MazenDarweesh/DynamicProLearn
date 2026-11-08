import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/platform-core/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { Dialog } from '../../../core/utils/dialog';
import { EvaluationsDashboardComponent } from '../../../shared/components/evaluations-dashboard/evaluations-dashboard.component';

@Component({
  selector: 'app-tester-details',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, EvaluationsDashboardComponent],
  templateUrl: './tester-details.component.html',
  styleUrls: ['./tester-details.component.css']
})
export class TesterDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);

  testerId = '';
  testerDetails: any = null;
  isLoading = true;
  
  formattedVersions: any[] = [];
  uniqueVersions: string[] = [];


  ngOnInit(): void {
    this.testerId = this.route.snapshot.paramMap.get('id') || '';
    if (this.testerId) {
      this.loadTesterDetails();
    } else {
      this.router.navigate(['/admin/testers']);
    }
  }

  loadTesterDetails(): void {
    this.isLoading = true;
    this.adminService.getTesterDetails(this.testerId).subscribe({
      next: (res) => {
        console.log('Tester Details Response:', res);
        this.testerDetails = res;
        this.formatFeedbacksToVersions();
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('فشل في تحميل بيانات المختبر', 'خطأ', 'error');
        this.isLoading = false;
        this.router.navigate(['/admin/testers']);
      }
    });
  }

  formatFeedbacksToVersions(): void {
    if (!this.testerDetails) return;
    const feedbacksList = this.testerDetails.feedbacks || this.testerDetails.Feedbacks;
    if (!feedbacksList) return;
    
    const versionsMap = new Map<string, any>();
    
    feedbacksList.forEach((f: any, index: number) => {
      const versionName = f.versionName || f.VersionName || 'نسخة مجهولة';
      if (!versionsMap.has(versionName)) {
        versionsMap.set(versionName, {
          versionName: versionName,
          totalLessons: 0,
          completedLessons: 0,
          modulesMap: new Map<string, any>()
        });
      }
      
      const versionObj = versionsMap.get(versionName);
      versionObj.totalLessons++;
      if (f.status !== 'غير مختبر') {
          versionObj.completedLessons++;
      }

      const fModuleName = f.moduleName || f.ModuleName;
      const fUnitName = f.unitName || f.UnitName;
      const fLessonName = f.lessonName || f.LessonName;
      const fStatus = f.status || f.Status || 'غير مختبر';
      const fComment = f.comment || f.Comment;
      const fEvaluationDate = f.evaluationDate || f.EvaluationDate;

      if (!versionObj.modulesMap.has(fModuleName)) {
        versionObj.modulesMap.set(fModuleName, {
          moduleId: versionName + '_' + fModuleName,
          name: fModuleName,
          totalLessons: 0,
          completedLessons: 0,
          unitsMap: new Map<string, any>()
        });
      }
      
      const moduleObj = versionObj.modulesMap.get(fModuleName);
      moduleObj.totalLessons++;
      if (fStatus !== 'غير مختبر') {
          moduleObj.completedLessons++;
      }
      
      if (!moduleObj.unitsMap.has(fUnitName)) {
        moduleObj.unitsMap.set(fUnitName, {
          unitId: versionName + '_' + fModuleName + '_' + fUnitName,
          name: fUnitName,
          lessons: []
        });
      }
      
      const unitObj = moduleObj.unitsMap.get(fUnitName);
      unitObj.lessons.push({
        lessonId: versionName + '_' + fModuleName + '_' + fUnitName + '_' + fLessonName + index,
        name: fLessonName,
        status: fStatus,
        comment: fComment,
        evaluationDate: fEvaluationDate
      });
    });
    
    this.formattedVersions = Array.from(versionsMap.values()).map(v => ({
      groupName: v.versionName,
      totalLessons: v.totalLessons,
      completedLessons: v.completedLessons,
      modules: Array.from((v.modulesMap as Map<string, any>).values()).map(m => ({
        moduleId: m.moduleId,
        name: m.name,
        totalLessons: m.totalLessons,
        completedLessons: m.completedLessons,
        units: Array.from((m.unitsMap as Map<string, any>).values())
      }))
    }));
    
    this.uniqueVersions = Array.from(versionsMap.keys());
  }

}
