import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';

@Component({
  selector: 'app-department-details',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent, AdminHeaderComponent],
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

  // Track expanded state for nested lists
  expandedModules: { [key: string]: boolean } = {};
  expandedUnits: { [key: string]: boolean } = {};

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
        Dialog.error('فشل في تحميل بيانات القسم');
        this.isLoading = false;
        this.router.navigate(['/admin/users']);
      }
    });
  }

  toggleModule(moduleId: string): void {
    this.expandedModules[moduleId] = !this.expandedModules[moduleId];
  }

  toggleUnit(unitId: string): void {
    this.expandedUnits[unitId] = !this.expandedUnits[unitId];
  }

  markLessonComplete(lessonId: string): void {
    Dialog.confirm('هل أنت متأكد من تحديد هذا الدرس كمكتمل لجميع أفراد القسم؟', () => {
      this.adminService.markLessonCompleteForDepartment(this.departmentId, lessonId).subscribe({
        next: () => {
          Dialog.success('تم تحديد الدرس كمكتمل بنجاح');
          this.loadDepartmentDetails(); // Refresh
        },
        error: () => Dialog.error('حدث خطأ أثناء تنفيذ العملية')
      });
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }
}
