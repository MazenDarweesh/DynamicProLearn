import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { Router, RouterModule } from '@angular/router';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { AdminActionButtonComponent } from '../../../shared/components/admin-action-button/admin-action-button.component';
import { AdminModalComponent } from '../../../shared/components/admin-modal/admin-modal.component';
import { AdminActionIconComponent } from '../../../shared/components/admin-action-icon/admin-action-icon.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-admin-testers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminHeaderComponent, AdminActionButtonComponent, AdminModalComponent, AdminActionIconComponent, ProgressBarComponent],
  templateUrl: './admin-testers.component.html',
  styleUrl: '../admin-dashboard/admin-dashboard.component.css'
})
export class AdminTestersComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private adminService = inject(AdminService);

  testersProgress: any[] = [];
  showAddTesterModal = false;
  showAddVersionModal = false;
  isSubmitting = false;

  newVersionLabel = '';
  editingVersionId: string | null = null;
  erpVersions: any[] = [];
  modules: any[] = [];

  // Tester form
  newTesterUsername = '';
  newTesterPassword = '';
  editingTesterId: string | null = null;

  // Available testers for version linking
  availableTesters: any[] = [];
  showAssignTesterModal = false;
  assigningVersionId: string | null = null;
  selectedTesterId = '';
  selectedModuleIds: string[] = [];
  currentVersionProgress: any = null;

  ngOnInit() {
    this.loadTestersProgress();
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

  loadTestersProgress() {
    this.adminService.getTestersProgress(1, 100).subscribe({
      next: (testers) => {
        this.testersProgress = testers.map((t: any) => ({
          userId: t.userId,
          name: t.username || t.userName,
          role: 'مختبر نظام',
          assignedVersions: t.assignedVersions,
          assignedModules: t.assignedModules,
          completed: t.completedLessons,
          totalLessons: t.totalLessons,
          progressValue: t.totalLessons ? Math.round((t.completedLessons / t.totalLessons) * 100) : 0
        }));
        // Store raw list for version-tester linking
        this.availableTesters = this.testersProgress;
      },
      error: (err) => console.error('Error fetching testers', err)
    });
  }

  loadModules() {
    this.adminService.getModules(1, 100).subscribe({
      next: (data) => { this.modules = data; }
    });
  }

  // ── Tester CRUD ──────────────────────────────────────────────────────────
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

  submitTester() {
    if (!this.newTesterUsername || (!this.editingTesterId && !this.newTesterPassword)) {
      Dialog.alert('الرجاء إدخال اسم المستخدم وكلمة المرور.', 'حقول مفقودة', 'info');
      return;
    }

    this.isSubmitting = true;

    if (this.editingTesterId) {
      const payload: any = { username: this.newTesterUsername, role: 2 };
      if (this.newTesterPassword) payload.password = this.newTesterPassword;

      this.adminService.updateUser(this.editingTesterId, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          Dialog.alert('تم تعديل حساب المختبر بنجاح!', 'نجاح', 'success');
          this.closeAddTesterModal();
          this.loadTestersProgress();
        },
        error: (err) => {
          this.isSubmitting = false;
          Dialog.alert('حدث خطأ: ' + (err.error?.message || err.error?.detail || 'خطأ غير معروف'), 'خطأ', 'error');
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
          Dialog.alert('حدث خطأ: ' + (err.error?.message || err.error?.detail || 'خطأ غير معروف'), 'خطأ', 'error');
        }
      });
    }
  }

  // ── Version CRUD ──────────────────────────────────────────────────────────
  loadVersions() {
    this.adminService.getVersionSummaries().subscribe({
      next: (data) => this.erpVersions = data,
      error: (err) => console.error('Error loading versions', err)
    });
  }

  openAddVersionModal() {
    this.editingVersionId = null;
    this.newVersionLabel = '';
    this.showAddVersionModal = true;
  }

  editVersion(version: any) {
    this.editingVersionId = version.id;
    this.newVersionLabel = version.versionLabel;
    this.showAddVersionModal = true;
  }

  async deleteVersion(version: any) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف هذا الإصدار؟', 'تأكيد الحذف');
    if (ok) {
      this.adminService.deleteVersion(version.id).subscribe({
        next: () => {
          Dialog.alert('تم حذف الإصدار بنجاح.', 'نجاح', 'success');
          this.loadVersions();
        },
        error: () => Dialog.alert('حدث خطأ أثناء الحذف.', 'خطأ', 'error')
      });
    }
  }

  closeAddVersionModal() {
    this.showAddVersionModal = false;
  }

  submitVersion() {
    if (!this.newVersionLabel.trim()) {
      Dialog.alert('الرجاء إدخال اسم الإصدار.', 'خطأ', 'info');
      return;
    }

    this.isSubmitting = true;

    if (this.editingVersionId) {
      this.adminService.updateVersion(this.editingVersionId, this.newVersionLabel.trim()).subscribe({
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
      this.adminService.createVersion(this.newVersionLabel.trim()).subscribe({
        next: () => {
          this.isSubmitting = false;
          Dialog.alert('تمت إضافة الإصدار بنجاح!', 'نجاح', 'success');
          this.closeAddVersionModal();
          this.loadVersions();
        },
        error: () => {
          this.isSubmitting = false;
          Dialog.alert('حدث خطأ أثناء إضافة الإصدار.', 'خطأ', 'error');
        }
      });
    }
  }

  // ── Version-Tester Assignment ──────────────────────────────────────────────
  openAssignTesterModal(version: any) {
    this.assigningVersionId = version.id;
    this.selectedTesterId = '';
    this.selectedModuleIds = [];
    this.currentVersionProgress = null;
    this.showAssignTesterModal = true;

    // Load current assignments
    this.adminService.getVersionProgress(version.id).subscribe({
      next: (res) => {
        this.currentVersionProgress = res;
      },
      error: (err) => console.error('Failed to load version progress', err)
    });
  }

  onTesterSelectionChange() {
    this.selectedModuleIds = [];
    if (this.currentVersionProgress && this.currentVersionProgress.testers) {
      const tester = this.currentVersionProgress.testers.find((t: any) => t.testerId === this.selectedTesterId);
      if (tester && tester.modules) {
        this.selectedModuleIds = tester.modules.map((m: any) => m.moduleId);
      }
    }
  }

  closeAssignTesterModal() {
    this.showAssignTesterModal = false;
  }

  toggleModuleSelection(moduleId: string) {
    const idx = this.selectedModuleIds.indexOf(moduleId);
    if (idx > -1) {
      this.selectedModuleIds.splice(idx, 1);
    } else {
      this.selectedModuleIds.push(moduleId);
    }
  }

  submitAssignTester() {
    if (!this.selectedTesterId || this.selectedModuleIds.length === 0 || !this.assigningVersionId) {
      Dialog.alert('الرجاء اختيار المختبر وموديول واحد على الأقل', 'تنبيه', 'info');
      return;
    }

    this.isSubmitting = true;
    this.adminService.assignTesterToVersion(this.assigningVersionId, this.selectedTesterId, this.selectedModuleIds).subscribe({
      next: () => {
        Dialog.alert('تم إسناد المختبر للنسخة بنجاح', 'نجاح', 'success');
        this.isSubmitting = false;
        this.closeAssignTesterModal();
        this.loadVersions(); // Refresh table counts
      },
      error: (err) => {
        Dialog.alert('حدث خطأ أثناء الإسناد', 'خطأ', 'error');
        this.isSubmitting = false;
      }
    });
  }
}
