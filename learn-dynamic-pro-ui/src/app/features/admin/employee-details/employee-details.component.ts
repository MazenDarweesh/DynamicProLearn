import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { CurriculumViewerComponent } from '../../../shared/components/curriculum-viewer/curriculum-viewer.component';

@Component({
  selector: 'app-employee-details',
  standalone: true,
  imports: [CommonModule, ProgressBarComponent, AdminHeaderComponent, CurriculumViewerComponent],
  templateUrl: './employee-details.component.html',
  styleUrls: ['./employee-details.component.css']
})
export class EmployeeDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminService = inject(AdminService);

  employeeId = '';
  employeeName = '';
  totalAssignedLessons = 0;
  totalCompletedLessons = 0;
  modules: any[] = [];
  
  isLoading = true;
  isAllExpanded = false;

  toggleExpandAll(): void {
    this.isAllExpanded = !this.isAllExpanded;
  }

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('id') || '';
    if (this.employeeId) {
      this.loadEmployeeDetails();
    } else {
      this.router.navigate(['/admin/employees']);
    }
  }

  loadEmployeeDetails(): void {
    this.isLoading = true;
    this.adminService.getUserDetails(this.employeeId).subscribe({
      next: (res) => {
        this.employeeName = res.userName;
        this.totalAssignedLessons = res.totalAssignedLessons;
        this.totalCompletedLessons = res.totalCompletedLessons;
        this.modules = res.modules;
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('فشل في تحميل بيانات الموظف', 'خطأ', 'error');
        this.isLoading = false;
        this.router.navigate(['/admin/employees']);
      }
    });
  }
}
