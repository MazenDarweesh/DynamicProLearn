import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ProgressBarComponent } from '../../../shared/components/progress-bar/progress-bar.component';

@Component({
  selector: 'app-users-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, ProgressBarComponent],
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

  showAddCompanyModal = false;
  editingCompanyId: string | null = null;
  newCompanyName = '';
  newDepartmentsList: { id?: string, name: string }[] = [];
  originalDepartments: any[] = [];
  newDepartmentName = '';

  showAssignModulesModal = false;
  assigningCompany: any = null;
  assigningDepartment: any = null;
  assignedModules: any[] = [];
  pendingAssignedModuleIds = new Set<string>();

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

  toggleExpand(companyId: string) {
    if (this.expandedCompanyId === companyId) {
      this.expandedCompanyId = null;
    } else {
      this.expandedCompanyId = companyId;
    }
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
      this.adminService.deleteCompany(comp.id).subscribe(() => {
        this.expandedCompanyId = null;
        this.loadData();
      });
    }
  }

  // --- Department Edit/Delete ---
  editDepartment(comp: any, dept: any) {
    this.editingDepartmentId = dept.id;
    this.editingDepartmentName = dept.name;
    this.showEditDepartmentModal = true;
  }

  closeEditDepartmentModal() {
    this.showEditDepartmentModal = false;
    this.editingDepartmentId = null;
    this.editingDepartmentName = '';
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
        // --- EDIT MODE ---
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
        // --- CREATE MODE ---
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
      console.error('Error saving company', err);
      Dialog.alert('حدث خطأ أثناء حفظ الشركة.', 'خطأ', 'error');
    }
  }

  // --- Assign Modules Logic ---
  openAssignModulesModal(company: any, department: any) {
    this.assigningCompany = company;
    this.assigningDepartment = department;
    this.assignedModules = [];
    this.pendingAssignedModuleIds.clear();
    this.showAssignModulesModal = true;
    
    this.adminService.getDepartmentAssignments(department.id).subscribe({
      next: (assignments) => {
        this.assignedModules = assignments;
        assignments.forEach((a: any) => this.pendingAssignedModuleIds.add(a.moduleId));
      },
      error: (err) => {
        console.error('Error fetching assignments', err);
      }
    });
  }

  closeAssignModulesModal() {
    this.showAssignModulesModal = false;
    this.assigningCompany = null;
    this.assigningDepartment = null;
    this.pendingAssignedModuleIds.clear();
  }

  isModuleAssigned(moduleId: string): boolean {
    return this.pendingAssignedModuleIds.has(moduleId);
  }

  toggleModuleAssignment(moduleId: string, event: any) {
    if (event.target.checked) {
      this.pendingAssignedModuleIds.add(moduleId);
    } else {
      this.pendingAssignedModuleIds.delete(moduleId);
    }
  }

  async saveModuleAssignments() {
    this.isSubmitting = true;
    const currentAssignmentIds = new Set(this.assignedModules.map(a => a.moduleId));
    const departmentId = this.assigningDepartment.id;

    const toAdd = Array.from(this.pendingAssignedModuleIds).filter(id => !currentAssignmentIds.has(id));
    const toRemove = this.assignedModules.filter(a => !this.pendingAssignedModuleIds.has(a.moduleId));

    try {
      for (const moduleId of toAdd) {
        await new Promise<void>((resolve, reject) => {
          this.adminService.assignModule(moduleId, departmentId).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }

      for (const assignment of toRemove) {
        await new Promise<void>((resolve, reject) => {
          this.adminService.removeAssignment(assignment.id).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }
      
      this.isSubmitting = false;
      Dialog.alert('تم حفظ إسنادات الموديولات بنجاح!', 'نجاح', 'success');
      this.closeAssignModulesModal();
    } catch (err: any) {
      this.isSubmitting = false;
      console.error('Error saving assignments', err);
      Dialog.alert('حدث خطأ أثناء حفظ الإسنادات.', 'خطأ', 'error');
    }
  }
}
