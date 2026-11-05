import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../../core/services/platform-core/admin.service';
import { AdminHeaderComponent } from '../../../../shared/components/admin-header/admin-header.component';
import { LessonDetailsAnalyticsDto } from '../../../../core/models/analytics.models';
import { Dialog } from '../../../../core/utils/dialog';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lesson-details-analytics',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, FormsModule],
  templateUrl: './lesson-details-analytics.component.html',
  styleUrls: ['./lesson-details-analytics.component.css']
})
export class LessonDetailsAnalyticsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);

  lessonId = '';
  details: LessonDetailsAnalyticsDto | null = null;
  isLoading = true;
  expandedCompanies = new Set<string>();
  expandedDepartments = new Set<string>();

  searchQuery = '';
  selectedCompanyId: string | null = null;
  selectedDepartmentId: string | null = null;

  ngOnInit(): void {
    this.lessonId = this.route.snapshot.paramMap.get('id') || '';
    if (this.lessonId) {
      this.loadDetails();
    } else {
      this.router.navigate(['/admin/analytics']);
    }
  }

  loadDetails(): void {
    this.isLoading = true;
    this.adminService.getLessonAnalytics(this.lessonId).subscribe({
      next: (res) => {
        this.details = res;
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('فشل في تحميل تفاصيل الإحصائيات', 'خطأ', 'error');
        this.isLoading = false;
        this.router.navigate(['/admin/analytics']);
      }
    });
  }

  toggleCompany(companyId: string): void {
    if (this.expandedCompanies.has(companyId)) {
      this.expandedCompanies.delete(companyId);
    } else {
      this.expandedCompanies.add(companyId);
    }
  }

  toggleDepartment(departmentId: string): void {
    if (this.expandedDepartments.has(departmentId)) {
      this.expandedDepartments.delete(departmentId);
    } else {
      this.expandedDepartments.add(departmentId);
    }
  }

  markComplete(targetType: string, targetId: string, name: string): void {
    let message = '';
    if (targetType === 'company') message = `هل أنت متأكد من اكتمال الدرس لجميع أفراد شركة (${name})؟`;
    else if (targetType === 'department') message = `هل أنت متأكد من اكتمال الدرس لجميع أفراد قسم (${name})؟`;
    else message = `هل أنت متأكد من إتمام الدرس للمستخدم (${name})؟`;

    Dialog.confirm(message, 'تأكيد').then((confirmed) => {
      if (confirmed) {
        this.adminService.completeLessonForTarget(this.lessonId, targetType, targetId).subscribe({
          next: () => {
            Dialog.alert('تم حفظ الإجراء بنجاح', 'نجاح', 'success');
            this.loadDetails(); // refresh
          },
          error: () => Dialog.alert('حدث خطأ أثناء حفظ الإجراء', 'خطأ', 'error')
        });
      }
    });
  }

  unmarkComplete(targetType: string, targetId: string, name: string): void {
    let message = '';
    if (targetType === 'company') message = `هل أنت متأكد من إلغاء اكتمال الدرس لجميع أفراد شركة (${name})؟`;
    else if (targetType === 'department') message = `هل أنت متأكد من إلغاء اكتمال الدرس لجميع أفراد قسم (${name})؟`;
    else message = `هل أنت متأكد من إلغاء إتمام الدرس للمستخدم (${name})؟`;

    Dialog.confirm(message, 'تأكيد').then((confirmed) => {
      if (confirmed) {
        this.adminService.uncompleteLessonForTarget(this.lessonId, targetType, targetId).subscribe({
          next: () => {
            Dialog.alert('تم حفظ الإجراء بنجاح', 'نجاح', 'success');
            this.loadDetails(); // refresh
          },
          error: () => Dialog.alert('حدث خطأ أثناء حفظ الإجراء', 'خطأ', 'error')
        });
      }
    });
  }

  get completionPercentage(): number {
    if (!this.details || this.details.totalEnrolledStudents === 0) return 0;
    return Math.round((this.details.totalCompletedStudents / this.details.totalEnrolledStudents) * 100);
  }

  getTotalUsers(company: any): number {
    if (!company || !company.departments) return 0;
    return company.departments.reduce((acc: number, dept: any) => acc + (dept.users ? dept.users.length : 0), 0);
  }

  get allCompanies() {
    return this.details?.companies || [];
  }

  get availableDepartments() {
    if (!this.details) return [];
    let companies = this.details.companies;
    if (this.selectedCompanyId) {
      companies = companies.filter(c => c.companyId === this.selectedCompanyId);
    }
    return companies.flatMap(c => c.departments);
  }

  get filteredCompanies() {
    if (!this.details) return [];

    let companies = this.details.companies;

    if (this.selectedCompanyId) {
      companies = companies.filter(c => c.companyId === this.selectedCompanyId);
    }

    return companies.map(company => {
      let depts = company.departments;

      if (this.selectedDepartmentId) {
        depts = depts.filter(d => d.departmentId === this.selectedDepartmentId);
      }

      if (this.searchQuery && this.searchQuery.trim() !== '') {
        const query = this.searchQuery.toLowerCase().trim();
        depts = depts.map(dept => {
          return {
            ...dept,
            users: dept.users.filter(u => u.userName.toLowerCase().includes(query))
          };
        }).filter(dept => dept.users.length > 0 || dept.departmentName.toLowerCase().includes(query));
      }

      return {
        ...company,
        departments: depts
      };
    }).filter(company => 
      company.departments.length > 0 || 
      (this.searchQuery && company.companyName.toLowerCase().includes(this.searchQuery.toLowerCase().trim())) ||
      (this.selectedDepartmentId === null && this.searchQuery.trim() === '') // Show empty companies if no specific dept/search is selected
    );
  }
}
