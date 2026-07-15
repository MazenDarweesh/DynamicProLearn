import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { AdminModalComponent } from '../../../shared/components/admin-modal/admin-modal.component';

@Component({
  selector: 'app-admin-version-details',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, AdminModalComponent],
  templateUrl: './admin-version-details.component.html',
  styleUrl: '../admin-dashboard/admin-dashboard.component.css'
})
export class AdminVersionDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private adminService = inject(AdminService);
  
  versionId = '';
  versionProgress: any = null;
  isLoading = true;

  showAssignTesterModal = false;
  isSubmitting = false;

  allTesters: any[] = [];
  allModules: any[] = [];

  selectedTesterId = '';
  selectedModules: string[] = [];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.versionId = params.get('id') || '';
      if (this.versionId) {
        this.loadVersionProgress();
      }
    });
  }

  loadVersionProgress() {
    this.isLoading = true;
    this.adminService.getVersionProgress(this.versionId).subscribe({
      next: (data) => {
        this.versionProgress = data;
        this.isLoading = false;
      },
      error: () => {
        Dialog.alert('حدث خطأ أثناء تحميل بيانات التقدم', 'خطأ', 'error');
        this.isLoading = false;
      }
    });
  }

  openAssignTesterModal() {
    this.selectedTesterId = '';
    this.selectedModules = [];
    
    // Load testers if not loaded
    if (this.allTesters.length === 0) {
      this.adminService.getTestersProgress(1, 100).subscribe(t => {
        this.allTesters = t;
      });
    }

    // Load modules if not loaded
    if (this.allModules.length === 0) {
      this.adminService.getModules(1, 100).subscribe(m => {
        this.allModules = m;
      });
    }

    this.showAssignTesterModal = true;
  }

  closeAssignTesterModal() {
    this.showAssignTesterModal = false;
  }

  toggleModuleSelection(moduleId: string) {
    const idx = this.selectedModules.indexOf(moduleId);
    if (idx > -1) {
      this.selectedModules.splice(idx, 1);
    } else {
      this.selectedModules.push(moduleId);
    }
  }

  submitAssignTester() {
    if (!this.selectedTesterId || this.selectedModules.length === 0) {
      Dialog.alert('الرجاء اختيار المختبر وموديول واحد على الأقل', 'تنبيه', 'info');
      return;
    }

    this.isSubmitting = true;
    this.adminService.assignTesterToVersion(this.versionId, this.selectedTesterId, this.selectedModules).subscribe({
      next: () => {
        Dialog.alert('تم إسناد المختبر والموديولات بنجاح', 'نجاح', 'success');
        this.isSubmitting = false;
        this.closeAssignTesterModal();
        this.loadVersionProgress(); // Reload
      },
      error: (err) => {
        Dialog.alert('حدث خطأ أثناء الإسناد', 'خطأ', 'error');
        this.isSubmitting = false;
      }
    });
  }
}
