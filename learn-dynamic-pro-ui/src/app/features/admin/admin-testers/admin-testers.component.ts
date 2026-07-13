import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { Router } from '@angular/router';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { AdminActionButtonComponent } from '../../../shared/components/admin-action-button/admin-action-button.component';
import { AdminModalComponent } from '../../../shared/components/admin-modal/admin-modal.component';
import { AdminActionIconComponent } from '../../../shared/components/admin-action-icon/admin-action-icon.component';

@Component({
  selector: 'app-admin-testers',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, AdminActionButtonComponent, AdminModalComponent, AdminActionIconComponent],
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
  showAddVersionModal = false;
  isSubmitting = false;

  newVersionLabel = '';
  testerIdForVersion = '';
  editingVersionId: string | null = null;
  erpVersions: any[] = [];
  modules: any[] = [];
  selectedModules: string[] = [];
  
  private http = inject(HttpClient);

  newTesterUsername = '';
  newTesterPassword = '';
  editingTesterId: string | null = null;
  
  companies: any[] = [];

  ngOnInit() {
    this.loadTestersProgress();
    this.loadCompanies();
    this.loadVersions();
    this.loadModules();
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
          userId: t.userId,
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

  loadModules() {
    this.adminService.getModules(1, 100).subscribe({
      next: (data) => {
        this.modules = data;
      }
    });
  }

  openAddTesterModal() {
    this.editingTesterId = null;
    this.newTesterUsername = '';
    this.newTesterPassword = '';
    this.showAddTesterModal = true;
  }

  editTester(t: any) {
    this.editingTesterId = t.userId;
    this.newTesterUsername = t.name;
    this.newTesterPassword = '';
    this.showAddTesterModal = true;
  }

  async deleteTester(t: any) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف حساب المختبر بكافة بياناته؟', 'تأكيد الحذف');
    if (ok) {
      this.adminService.deleteUser(t.userId).subscribe({
        next: () => {
          Dialog.alert('تم حذف حساب المختبر بنجاح.', 'نجاح', 'success');
          this.loadTestersProgress();
        },
        error: () => Dialog.alert('حدث خطأ أثناء الحذف.', 'خطأ', 'error')
      });
    }
  }

  closeAddTesterModal() {
    this.showAddTesterModal = false;
  }

  loadVersions() {
    this.http.get<any[]>('http://localhost:5115/api/admin/test-cycles').subscribe({
      next: (data) => this.erpVersions = data,
      error: (err) => console.error(err)
    });
  }

  openAddVersionModal() {
    this.editingVersionId = null;
    this.newVersionLabel = '';
    this.testerIdForVersion = '';
    this.selectedModules = [];
    this.showAddVersionModal = true;
  }

  editVersion(version: any) {
    this.editingVersionId = version.id;
    this.newVersionLabel = version.versionLabel;
    this.testerIdForVersion = version.testerId;
    this.selectedModules = version.moduleIds ? [...version.moduleIds] : [];
    this.showAddVersionModal = true;
  }

  async deleteVersion(version: any) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف هذا الإصدار؟', 'تأكيد الحذف');
    if (ok) {
      this.http.delete(`http://localhost:5115/api/admin/test-cycles/${version.id}`).subscribe({
        next: () => {
          Dialog.alert('تم حذف الإصدار بنجاح.', 'نجاح', 'success');
          this.loadVersions();
        },
        error: () => {
          Dialog.alert('حدث خطأ أثناء الحذف.', 'خطأ', 'error');
        }
      });
    }
  }

  closeAddVersionModal() {
    this.showAddVersionModal = false;
  }

  toggleModuleSelection(moduleId: string) {
    const idx = this.selectedModules.indexOf(moduleId);
    if (idx > -1) {
      this.selectedModules.splice(idx, 1);
    } else {
      this.selectedModules.push(moduleId);
    }
  }

  submitVersion() {
    if (!this.newVersionLabel.trim() || !this.testerIdForVersion) {
      Dialog.alert('الرجاء إدخال اسم الإصدار وتحديد المختبر.', 'خطأ', 'info');
      return;
    }
    
    this.isSubmitting = true;
    const payload = {
      versionLabel: this.newVersionLabel.trim(),
      testerId: this.testerIdForVersion,
      moduleIds: this.selectedModules
    };

    if (this.editingVersionId) {
      this.http.put(`http://localhost:5115/api/admin/test-cycles/${this.editingVersionId}`, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          Dialog.alert('تم تعديل الإصدار بنجاح!', 'نجاح', 'success');
          this.closeAddVersionModal();
          this.loadVersions();
        },
        error: () => {
          this.isSubmitting = false;
          Dialog.alert('حدث خطأ أثناء التعديل.', 'خطأ', 'error');
        }
      });
    } else {
      this.http.post<any>('http://localhost:5115/api/admin/test-cycles', { 
        versionLabel: this.newVersionLabel.trim(),
        testerId: this.testerIdForVersion
      }).subscribe({
        next: (res) => {
          if (this.selectedModules.length > 0) {
            this.http.post(`http://localhost:5115/api/admin/test-cycles/${res.id}/modules`, {
              moduleIds: this.selectedModules
            }).subscribe({
              next: () => {
                this.isSubmitting = false;
                Dialog.alert('تمت إضافة الدورة وتخصيص الموديولات بنجاح!', 'نجاح', 'success');
                this.closeAddVersionModal();
                this.loadVersions();
              },
              error: () => {
                this.isSubmitting = false;
                Dialog.alert('تم إنشاء الدورة ولكن حدث خطأ أثناء ربط الموديولات.', 'تحذير', 'info');
              }
            });
          } else {
            this.isSubmitting = false;
            Dialog.alert('تمت إضافة الدورة بنجاح!', 'نجاح', 'success');
            this.closeAddVersionModal();
            this.loadVersions();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          Dialog.alert('حدث خطأ أثناء إضافة الإصدار.', 'خطأ', 'error');
        }
      });
    }
  }

  submitTester() {
    if (!this.newTesterUsername || (!this.editingTesterId && !this.newTesterPassword)) {
      Dialog.alert('الرجاء إدخال اسم المستخدم وكلمة المرور.', 'حقول مفقودة', 'info');
      return;
    }

    this.isSubmitting = true;

    if (this.editingTesterId) {
      const payload: any = { username: this.newTesterUsername, role: 2 };
      if (this.newTesterPassword) {
         payload.password = this.newTesterPassword;
      }
      this.adminService.updateUser(this.editingTesterId, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          Dialog.alert('تم تعديل حساب المختبر بنجاح!', 'نجاح', 'success');
          this.closeAddTesterModal();
          this.loadTestersProgress();
        },
        error: (err) => {
          this.isSubmitting = false;
          Dialog.alert('حدث خطأ أثناء التعديل: ' + (err.error?.detail || err.message), 'خطأ', 'error');
        }
      });
    } else {
      this.adminService.createUser(null, null, this.newTesterUsername, this.newTesterPassword, 2).subscribe({
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
}
