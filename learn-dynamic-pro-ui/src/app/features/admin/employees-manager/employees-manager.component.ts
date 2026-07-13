import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ExpandableTableComponent } from '../../../shared/components/expandable-table/expandable-table.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-employees-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminHeaderComponent, ExpandableTableComponent, ProgressBarComponent],
  templateUrl: './employees-manager.component.html',
  styleUrls: ['./employees-manager.component.css']
})
export class EmployeesManagerComponent implements OnInit {
  private adminService = inject(AdminService);

  employees: any[] = [];
  companies: any[] = [];
  departments: any[] = [];
  filteredDepartments: any[] = [];
  
  filterCompanyId: string | null = null;
  filterDepartmentId: string | null = null;

  totalEmployees = 0;
  currentPage = 1;
  pageSize = 10;
  isLoading = false;

  // Modal State
  showModal = false;
  isEditMode = false;
  formData: any = {};
  filteredDepartmentsForForm: any[] = [];

  ngOnInit() {
    this.loadFilterData();
    this.loadEmployees();
  }

  loadFilterData() {
    this.adminService.getCompanies(1, 100).subscribe({
      next: (res) => {
        this.companies = res;
      }
    });
  }

  onFilterChange() {
    this.filterDepartmentId = null;
    if (this.filterCompanyId) {
      this.adminService.getDepartments(this.filterCompanyId, 1, 100).subscribe({
        next: (res) => {
          this.filteredDepartments = res;
          this.loadEmployees();
        }
      });
    } else {
      this.filteredDepartments = [];
      this.loadEmployees();
    }
  }

  loadEmployees() {
    this.isLoading = true;
    this.adminService.getAllUsersProgress(this.filterCompanyId, this.filterDepartmentId, this.currentPage, this.pageSize).subscribe({
      next: (res: any) => {
        this.employees = res.items || [];
        this.totalEmployees = res.totalCount || 0; 
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  changePage(page: number) {
    this.currentPage = page;
    this.loadEmployees();
  }

  getMathMin(a: number, b: number) {
    return Math.min(a, b);
  }

  openAddModal() {
    this.isEditMode = false;
    this.formData = {
      username: '',
      password: '',
      companyId: this.filterCompanyId || null,
      departmentId: this.filterDepartmentId || null
    };

    if (this.formData.companyId) {
      this.adminService.getDepartments(this.formData.companyId, 1, 100).subscribe(res => {
        this.filteredDepartmentsForForm = res;
      });
    } else {
      this.filteredDepartmentsForForm = [];
    }

    this.showModal = true;
  }

  openEditModal(emp: any) {
    this.isEditMode = true;
    this.formData = {
      userId: emp.userId,
      username: emp.userName,
      password: '',
      companyId: emp.companyId,
      departmentId: emp.departmentId
    };
    
    // Load departments for this company
    this.adminService.getDepartments(emp.companyId, 1, 100).subscribe(res => {
      this.filteredDepartmentsForForm = res;
      this.showModal = true;
    });
  }

  onFormCompanyChange() {
    this.formData.departmentId = null;
    if (this.formData.companyId) {
      this.adminService.getDepartments(this.formData.companyId, 1, 100).subscribe(res => {
        this.filteredDepartmentsForForm = res;
      });
    } else {
      this.filteredDepartmentsForForm = [];
    }
  }

  closeModal() {
    this.showModal = false;
  }

  saveEmployee() {
    if (!this.formData.username || !this.formData.companyId || !this.formData.departmentId) {
      Dialog.alert('يرجى ملء جميع الحقول المطلوبة', 'خطأ', 'error');
      return;
    }

    if (this.isEditMode) {
      const payload = {
        username: this.formData.username,
        password: this.formData.password,
        companyId: this.formData.companyId,
        departmentId: this.formData.departmentId
      };

      this.adminService.updateUser(this.formData.userId, payload).subscribe({
        next: () => {
          Dialog.alert('تم تعديل بيانات الموظف بنجاح', 'نجاح', 'success');
          this.closeModal();
          this.loadEmployees();
        },
        error: () => {
          Dialog.alert('حدث خطأ أثناء حفظ التعديلات', 'خطأ', 'error');
        }
      });
    } else {
      if (!this.formData.password) {
        Dialog.alert('كلمة المرور مطلوبة للموظف الجديد', 'خطأ', 'error');
        return;
      }
      this.adminService.createUser(this.formData.companyId, this.formData.departmentId, this.formData.username, this.formData.password).subscribe({
        next: () => {
          Dialog.alert('تمت إضافة الموظف بنجاح', 'نجاح', 'success');
          this.closeModal();
          this.loadEmployees();
        },
        error: (err) => {
          Dialog.alert(err?.error?.message || 'حدث خطأ أثناء إضافة الموظف', 'خطأ', 'error');
        }
      });
    }
  }

  deleteEmployee(userId: string) {
    Dialog.confirm('هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.', 'تأكيد الحذف').then(confirmed => {
      if (confirmed) {
        console.log(`[FRONTEND] Triggering delete for employee ${userId}...`);
        this.adminService.deleteUser(userId).subscribe({
          next: () => {
            console.log(`[FRONTEND] Delete employee SUCCESS`);
            Dialog.alert('تم حذف الموظف بنجاح', 'نجاح', 'success');
            this.loadEmployees();
          },
          error: (err) => {
            console.error(`[FRONTEND] Delete employee FAILED`, err);
            Dialog.alert('حدث خطأ أثناء الحذف. تحقق من الـ Console.', 'خطأ', 'error');
          }
        });
      }
    });
  }
}
