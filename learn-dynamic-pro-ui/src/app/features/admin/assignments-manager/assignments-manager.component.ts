import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ExpandableTableComponent } from '../../../shared/components/expandable-table/expandable-table.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-assignments-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, ExpandableTableComponent, ProgressBarComponent],
  templateUrl: './assignments-manager.component.html',
  styleUrls: ['./assignments-manager.component.css']
})
export class AssignmentsManagerComponent implements OnInit {
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

  // Edit Modal State
  showEditModal = false;
  editData: any = {};
  editFilteredDepartments: any[] = [];

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

  openEditModal(emp: any) {
    this.editData = {
      userId: emp.userId,
      username: emp.userName,
      password: '',
      companyId: emp.companyId,
      departmentId: emp.departmentId
    };
    
    // Load departments for this company
    this.adminService.getDepartments(emp.companyId, 1, 100).subscribe(res => {
      this.editFilteredDepartments = res;
      this.showEditModal = true;
    });
  }

  onEditCompanyChange() {
    this.editData.departmentId = null;
    if (this.editData.companyId) {
      this.adminService.getDepartments(this.editData.companyId, 1, 100).subscribe(res => {
        this.editFilteredDepartments = res;
      });
    } else {
      this.editFilteredDepartments = [];
    }
  }

  closeEditModal() {
    this.showEditModal = false;
  }

  saveEmployee() {
    if (!this.editData.username || !this.editData.companyId || !this.editData.departmentId) {
      Dialog.alert('يرجى ملء جميع الحقول المطلوبة', 'خطأ');
      return;
    }

    const payload = {
      username: this.editData.username,
      password: this.editData.password,
      companyId: this.editData.companyId,
      departmentId: this.editData.departmentId
    };

    this.adminService.updateUser(this.editData.userId, payload).subscribe({
      next: () => {
        Dialog.toast('تم تعديل بيانات الموظف بنجاح', 'success');
        this.closeEditModal();
        this.loadEmployees();
      },
      error: () => {
        Dialog.alert('حدث خطأ أثناء حفظ التعديلات', 'خطأ', 'error');
      }
    });
  }

  deleteEmployee(userId: string) {
    Dialog.confirm('هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.', 'تأكيد الحذف').then(confirmed => {
      if (confirmed) {
        this.adminService.deleteUser(userId).subscribe({
          next: () => {
            Dialog.toast('تم حذف الموظف بنجاح', 'success');
            this.loadEmployees();
          },
          error: () => {
            Dialog.alert('حدث خطأ أثناء الحذف', 'خطأ', 'error');
          }
        });
      }
    });
  }
}
