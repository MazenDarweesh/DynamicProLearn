import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { Router } from '@angular/router';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-admin-testers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-testers.component.html',
  styleUrl: '../admin-dashboard/admin-dashboard.component.css'
})
export class AdminTestersComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private adminService = inject(AdminService);

  testersProgress: any[] = [];
  showAllTesters = false;
  showAddTesterModal = false;
  isSubmitting = false;

  newTesterUsername = '';
  newTesterPassword = '';
  testerCompanyId = '';
  testerDepartmentId = '';
  
  companies: any[] = [];
  testerDepartments: any[] = [];

  ngOnInit() {
    this.loadTestersProgress();
    this.loadCompanies();
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  loadCompanies() {
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        this.companies.forEach(c => {
          this.adminService.getDepartments(c.id).subscribe(depts => {
            c.departments = depts;
          });
        });
      }
    });
  }

  loadTestersProgress() {
    this.adminService.getTestersProgress(1, 100).subscribe({
      next: (testers) => {
        this.testersProgress = testers.map((t: any) => ({
          name: t.userName,
          role: 'مختبر نظام',
          assignedModules: t.assignedModules,
          completed: t.completedLessons,
          totalLessons: t.totalLessons,
          progressValue: t.totalLessons ? Math.round((t.completedLessons / t.totalLessons) * 100) : 0
        }));
      },
      error: (err) => console.error('Error fetching testers', err)
    });
  }

  openAddTesterModal() {
    this.newTesterUsername = '';
    this.newTesterPassword = '';
    this.testerCompanyId = '';
    this.testerDepartmentId = '';
    this.testerDepartments = [];
    this.showAddTesterModal = true;
  }

  closeAddTesterModal() {
    this.showAddTesterModal = false;
  }

  onTesterCompanyChange() {
    const company = this.companies.find(c => c.id === this.testerCompanyId);
    this.testerDepartments = company ? company.departments : [];
    this.testerDepartmentId = '';
  }

  submitTester() {
    if (!this.newTesterUsername || !this.newTesterPassword || !this.testerCompanyId || !this.testerDepartmentId) {
      Dialog.alert('الرجاء إكمال جميع الحقول المطلوبة للمختبر.', 'حقول مفقودة', 'info');
      return;
    }

    this.isSubmitting = true;
    this.adminService.createUser(this.testerCompanyId, this.testerDepartmentId, this.newTesterUsername, this.newTesterPassword, 2).subscribe({
      next: () => {
        this.isSubmitting = false;
        Dialog.alert('تمت إضافة المختبر بنجاح!', 'نجاح', 'success');
        this.closeAddTesterModal();
        this.loadTestersProgress();
      },
      error: (err) => {
        this.isSubmitting = false;
        Dialog.alert('حدث خطأ أثناء الإضافة: ' + (err.error?.detail || err.message), 'خطأ', 'error');
      }
    });
  }
}
