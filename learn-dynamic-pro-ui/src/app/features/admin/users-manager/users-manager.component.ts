import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/platform-core/admin.service';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';
import { RouterModule } from '@angular/router';
import { ExpandableTableComponent } from '../../../shared/components/expandable-table/expandable-table.component';
import { AdminActionButtonComponent } from '../../../shared/components/admin-action-button/admin-action-button.component';
import { AdminModalComponent } from '../../../shared/components/admin-modal/admin-modal.component';
import { AdminActionIconComponent } from '../../../shared/components/admin-action-icon/admin-action-icon.component';
import { AssignModulesModalComponent } from '../../../shared/components/assign-modules-modal/assign-modules-modal.component';
import { CompanyModalComponent } from '../../../shared/components/company-modal/company-modal.component';

@Component({
  selector: 'app-users-manager',
  standalone: true,
  imports: [
    CommonModule, FormsModule, AdminHeaderComponent, ProgressBarComponent,
    RouterModule, ExpandableTableComponent, AdminActionButtonComponent,
    AdminModalComponent, AdminActionIconComponent, AssignModulesModalComponent, CompanyModalComponent
  ],
  templateUrl: './users-manager.component.html',
  styleUrls: ['./users-manager.component.css']
})
export class UsersManagerComponent implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);

  companies: any[] = [];
  filteredCompanies: any[] = [];
  paginatedCompanies: any[] = [];
  allModules: any[] = [];
  moduleSearchQuery: string = '';

  isLoading = true;
  isSubmitting = false;

  // Search and Pagination
  searchQuery = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  expandedCompanyId: string | null = null;

  // Modals state
  showEditDepartmentModal = false;
  editingDepartmentId: string | null = null;
  editingDepartmentName = '';
  editingDepartmentCompany: any = null; // Track company for module assignment from edit modal

  showAddCompanyModal = false;
  editingCompanyId: string | null = null;
  newCompanyName = '';
  newDepartmentsList: { id?: string, name: string }[] = [];
  originalDepartments: any[] = [];
  newDepartmentName = '';

  showAssignModulesModal = false;
  assigningCompany: any = null;
  assigningDepartment: any = null;

  ngOnInit() {
    this.loadData();
    this.loadModules();
  }

  loadData() {
    this.isLoading = true;
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        this.companies.forEach(c => {
          this.adminService.getDepartments(c.id).subscribe(depts => {
            c.departments = depts;
          });
        });
        this.isLoading = false;
        this.onSearch();
      },
      error: () => this.isLoading = false
    });
  }

  loadModules() {
    this.adminService.getModules().subscribe({
      next: (data) => this.allModules = data,
      error: (err) => console.error('Error fetching modules', err)
    });
  }

  goBack() {
    this.router.navigate(['/admin']);
  }

  onSearch() {
    this.currentPage = 1;
    if (this.searchQuery.trim()) {
      const lowerQuery = this.searchQuery.toLowerCase();
      this.filteredCompanies = this.companies.filter(c => c.name.toLowerCase().includes(lowerQuery));
    } else {
      this.filteredCompanies = [...this.companies];
    }
    this.totalPages = Math.ceil(this.filteredCompanies.length / this.pageSize);
    this.updatePagination();
  }

  updatePagination() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedCompanies = this.filteredCompanies.slice(startIndex, startIndex + this.pageSize);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getMathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  toggleExpand(companyId: string) {
    this.expandedCompanyId = this.expandedCompanyId === companyId ? null : companyId;
  }

  // --- Company Edit/Delete ---
  openAddCompanyModal() {
    this.editingCompanyId = null;
    this.originalDepartments = [];
    this.showAddCompanyModal = true;
    this.newCompanyName = '';
    this.newDepartmentName = '';
    this.newDepartmentsList = [];
  }

  editCompany(comp: any) {
    this.editingCompanyId = comp.id;
    this.newCompanyName = comp.name;
    this.newDepartmentsList = (comp.departments || []).map((d: any) => ({
      id: d.id,
      name: d.name
    }));
    this.originalDepartments = JSON.parse(JSON.stringify(this.newDepartmentsList));
    this.showAddCompanyModal = true;
  }

  async deleteCompany(comp: any) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف الشركة بجميع محتوياتها؟', 'تأكيد الحذف');
    if (ok) {
      this.adminService.deleteCompany(comp.id).subscribe({
        next: () => {
          this.expandedCompanyId = null;
          this.loadData();
          Dialog.alert('تم حذف الشركة بنجاح.', 'نجاح', 'success');
        },
        error: () => Dialog.alert('حدث خطأ أثناء حذف الشركة.', 'خطأ', 'error')
      });
    }
  }

  // --- Department Edit/Delete ---
  editDepartment(comp: any, dept: any) {
    this.editingDepartmentId = dept.id;
    this.editingDepartmentName = dept.name;
    this.editingDepartmentCompany = comp; // Store company reference
    this.showEditDepartmentModal = true;
  }

  closeEditDepartmentModal() {
    this.showEditDepartmentModal = false;
    this.editingDepartmentId = null;
    this.editingDepartmentName = '';
    this.editingDepartmentCompany = null;
  }

  saveDepartmentEdit() {
    if (!this.editingDepartmentName.trim() || !this.editingDepartmentId) return;

    this.isSubmitting = true;
    this.adminService.updateDepartment(this.editingDepartmentId, this.editingDepartmentName.trim()).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.closeEditDepartmentModal();
        this.loadData();
        Dialog.alert('تم تعديل اسم القسم بنجاح.', 'نجاح', 'success');
      },
      error: () => {
        this.isSubmitting = false;
        Dialog.alert('حدث خطأ أثناء التعديل.', 'خطأ', 'error');
      }
    });
  }

  /** Opens AssignModulesModal directly from the department edit modal */
  openModulesFromEdit() {
    if (!this.editingDepartmentId || !this.editingDepartmentCompany) return;
    const deptObj = { id: this.editingDepartmentId, name: this.editingDepartmentName };
    this.closeEditDepartmentModal();
    this.openAssignModulesModal(this.editingDepartmentCompany, deptObj);
  }

  async deleteDepartment(comp: any, dept: any) {
    const ok = await Dialog.confirm(`هل أنت متأكد من حذف قسم "${dept.name}"؟ جميع المستخدمين المرتبطين به سيتأثرون.`, 'تأكيد الحذف');
    if (ok) {
      this.adminService.deleteDepartment(dept.id).subscribe({
        next: () => {
          this.loadData();
          Dialog.alert('تم حذف القسم بنجاح.', 'نجاح', 'success');
        },
        error: () => Dialog.alert('حدث خطأ أثناء الحذف.', 'خطأ', 'error')
      });
    }
  }

  // --- Add Company Modal Logic ---
  closeAddCompanyModal() {
    this.showAddCompanyModal = false;
  }

  addDepartmentToList() {
    if (this.newDepartmentName.trim()) {
      this.newDepartmentsList.push({ name: this.newDepartmentName.trim() });
      this.newDepartmentName = '';
    }
  }

  removeDepartmentFromList(index: number) {
    this.newDepartmentsList.splice(index, 1);
  }

  async saveCompany() {
    if (this.isSubmitting) return;
    if (!this.newCompanyName.trim()) {
      Dialog.alert('الرجاء إدخال اسم الشركة', 'تنبيه', 'info');
      return;
    }

    this.isSubmitting = true;
    try {
      if (this.editingCompanyId) {
        await this.adminService.updateCompany(this.editingCompanyId, this.newCompanyName).toPromise();

        const currentDeptIds = this.newDepartmentsList.filter(d => d.id).map(d => d.id);
        const originalDeptIds = this.originalDepartments.map(d => d.id);
        const deptsToDelete = originalDeptIds.filter(id => !currentDeptIds.includes(id));

        if (deptsToDelete.length > 0) {
          await Promise.all(deptsToDelete.map(id => this.adminService.deleteDepartment(id).toPromise()));
        }

        const validDepts = this.newDepartmentsList.filter(d => d.name.trim());
        const deptPromises = validDepts.map(dept => {
          if (dept.id) {
            return this.adminService.updateDepartment(dept.id, dept.name.trim()).toPromise();
          } else {
            return this.adminService.createDepartment(this.editingCompanyId!, dept.name.trim()).toPromise();
          }
        });
        await Promise.all(deptPromises);
      } else {
        const comp = await this.adminService.createCompany(this.newCompanyName).toPromise();
        const companyId = comp.id;
        const validDepts = this.newDepartmentsList.filter(d => d.name.trim());
        const deptPromises = validDepts.map(dept =>
          this.adminService.createDepartment(companyId, dept.name.trim()).toPromise()
        );
        await Promise.all(deptPromises);
      }

      this.isSubmitting = false;
      this.closeAddCompanyModal();
      this.loadData();
    } catch (err) {
      this.isSubmitting = false;
      Dialog.alert('حدث خطأ أثناء حفظ الشركة.', 'خطأ', 'error');
    }
  }

  // --- Assign Modules Logic ---
  openAssignModulesModal(company: any, department: any) {
    this.assigningCompany = company;
    this.assigningDepartment = department;
    this.showAssignModulesModal = true;
  }

  closeAssignModulesModal() {
    this.showAssignModulesModal = false;
    this.assigningCompany = null;
    this.assigningDepartment = null;
  }

  getFilteredModules() {
    if (!this.moduleSearchQuery.trim()) return this.allModules;
    const query = this.moduleSearchQuery.toLowerCase();
    return this.allModules.filter(m => m.name && m.name.toLowerCase().includes(query));
  }
}
