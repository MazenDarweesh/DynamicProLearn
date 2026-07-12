import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ExpandableTableComponent } from '../../../shared/components/expandable-table/expandable-table.component';

@Component({
  selector: 'app-department-details',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent, AdminHeaderComponent, ExpandableTableComponent],
  templateUrl: './department-details.component.html',
  styleUrls: ['./department-details.component.css']
})
export class DepartmentDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);

  departmentId = '';
  departmentName = '';
  totalUsers = 0;
  modules: any[] = [];
  
  isLoading = true;

  // Track expanded state for all modules and units
  isAllExpanded = false;

  toggleExpandAll(): void {
    this.isAllExpanded = !this.isAllExpanded;
  }

  ngOnInit(): void {
    this.departmentId = this.route.snapshot.paramMap.get('id') || '';
    if (this.departmentId) {
      this.loadDepartmentDetails();
    } else {
      this.router.navigate(['/admin/users']);
    }
  }

  loadDepartmentDetails(): void {
    this.isLoading = true;
    this.adminService.getDepartmentDetails(this.departmentId).subscribe({
      next: (res) => {
        this.departmentName = res.departmentName;
        this.totalUsers = res.totalUsers;
        this.modules = res.modules;
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('فشل في تحميل بيانات القسم', 'خطأ', 'error');
        this.isLoading = false;
        this.router.navigate(['/admin/users']);
      }
    });
  }



  markLessonComplete(lessonId: string): void {
    Dialog.confirm('هل أنت متأكد من تحديد هذا الدرس كمكتمل لجميع أفراد القسم؟', 'تأكيد').then((confirmed) => {
      if (confirmed) {
        this.adminService.markLessonCompleteForDepartment(this.departmentId, lessonId).subscribe({
          next: () => {
            Dialog.alert('تم تحديد الدرس كمكتمل بنجاح', 'نجاح', 'success');
            this.loadDepartmentDetails(); // Refresh
          },
          error: () => Dialog.alert('حدث خطأ أثناء تنفيذ العملية', 'خطأ', 'error')
        });
      }
    });
  }

  unmarkLessonComplete(lessonId: string): void {
    Dialog.confirm('هل أنت متأكد من إلغاء اكتمال هذا الدرس لجميع أفراد القسم؟', 'تأكيد').then((confirmed) => {
      if (confirmed) {
        this.adminService.unmarkLessonCompleteForDepartment(this.departmentId, lessonId).subscribe({
          next: () => {
            Dialog.alert('تم إلغاء الاكتمال بنجاح', 'نجاح', 'success');
            this.loadDepartmentDetails(); // Refresh
          },
          error: () => Dialog.alert('حدث خطأ أثناء تنفيذ العملية', 'خطأ', 'error')
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }
}
