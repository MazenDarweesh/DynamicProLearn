import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-tester-details',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, ProgressBarComponent],
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
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('فشل في تحميل بيانات المختبر', 'خطأ', 'error');
        this.isLoading = false;
        this.router.navigate(['/admin/testers']);
      }
    });
  }

  exportToExcel(): void {
    if (!this.testerDetails || !this.testerDetails.feedbacks || this.testerDetails.feedbacks.length === 0) {
      Dialog.alert('لا توجد بيانات لتصديرها', 'تنبيه', 'warning');
      return;
    }

    const dataToExport = this.testerDetails.feedbacks.map((f: any) => ({
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
