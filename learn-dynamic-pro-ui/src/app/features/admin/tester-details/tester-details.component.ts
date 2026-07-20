import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';
import * as XLSX from 'xlsx';

import { CurriculumViewerComponent } from '../../../shared/components/curriculum-viewer/curriculum-viewer.component';

@Component({
  selector: 'app-tester-details',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, ProgressBarComponent, CurriculumViewerComponent],
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
  isAllExpanded = false;
  
  formattedVersions: any[] = [];
  filteredVersions: any[] = [];

  searchQuery = '';
  selectedVersion = '';
  uniqueVersions: string[] = [];

  toggleExpandAll(): void {
    this.isAllExpanded = !this.isAllExpanded;
  }

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
    if (!this.testerDetails || !this.testerDetails.feedbacks) return;
    
    const versionsMap = new Map<string, any>();
    
    this.testerDetails.feedbacks.forEach((f: any, index: number) => {
      const versionName = f.versionName || 'نسخة مجهولة';
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

      if (!versionObj.modulesMap.has(f.moduleName)) {
        versionObj.modulesMap.set(f.moduleName, {
          moduleId: versionName + '_' + f.moduleName,
          name: f.moduleName,
          totalLessons: 0,
          completedLessons: 0,
          unitsMap: new Map<string, any>()
        });
      }
      
      const moduleObj = versionObj.modulesMap.get(f.moduleName);
      moduleObj.totalLessons++;
      if (f.status !== 'غير مختبر') {
          moduleObj.completedLessons++;
      }
      
      if (!moduleObj.unitsMap.has(f.unitName)) {
        moduleObj.unitsMap.set(f.unitName, {
          unitId: versionName + '_' + f.moduleName + '_' + f.unitName,
          name: f.unitName,
          lessons: []
        });
      }
      
      const unitObj = moduleObj.unitsMap.get(f.unitName);
      unitObj.lessons.push({
        lessonId: versionName + '_' + f.moduleName + '_' + f.unitName + '_' + f.lessonName + index,
        name: f.lessonName,
        status: f.status,
        comment: f.comment,
        evaluationDate: f.evaluationDate
      });
    });
    
    this.formattedVersions = Array.from(versionsMap.values()).map(v => ({
      versionName: v.versionName,
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
    this.applyFilters();
  }

  applyFilters(): void {
    let result = this.formattedVersions;

    if (this.selectedVersion) {
      result = result.filter(v => v.versionName === this.selectedVersion);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      
      result = result.map(v => {
        const filteredModules = v.modules.map((m: any) => {
          const filteredUnits = m.units.map((u: any) => {
            const filteredLessons = u.lessons.filter((l: any) => l.name.toLowerCase().includes(q));
            return { ...u, lessons: filteredLessons };
          }).filter((u: any) => u.lessons.length > 0);
          
          return { ...m, units: filteredUnits };
        }).filter((m: any) => m.units.length > 0);
        
        return { ...v, modules: filteredModules };
      }).filter(v => v.modules.length > 0);
    }

    this.filteredVersions = result;
  }

  exportToExcel(): void {
    if (!this.testerDetails || !this.testerDetails.feedbacks || this.testerDetails.feedbacks.length === 0) {
      Dialog.alert('لا توجد بيانات لتصديرها', 'تنبيه', 'info');
      return;
    }

    const dataToExport = this.testerDetails.feedbacks.map((f: any) => ({
      'النسخة': f.versionName || 'نسخة مجهولة',
      'الموديول': f.moduleName,
      'الوحدة': f.unitName,
      'الدرس': f.lessonName,
      'الحالة': f.status,
      'تعليقات المختبر': f.comment || 'لا يوجد تعليق',
      'تاريخ التقييم': f.evaluationDate ? new Date(f.evaluationDate).toLocaleDateString('ar-EG') : 'غير متوفر'
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقييمات المختبر');

    // RTL direction for Excel sheet
    if(!ws['!dir']) ws['!dir'] = 'rtl';

    const fileName = `تقييمات_المختبر_${this.testerDetails.name}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
