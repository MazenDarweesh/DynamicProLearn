import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/platform-core/admin.service';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-company-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './company-modal.component.html',
  styleUrls: ['./company-modal.component.css']
})
export class CompanyModalComponent implements OnChanges {
  @Input() show: boolean = false;
  @Input() editingCompanyId: string | null = null;
  @Input() initialCompanyName: string = '';
  @Input() initialDepartments: any[] = [];

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private adminService = inject(AdminService);

  companyName = '';
  departmentsList: { id?: string, name: string }[] = [];
  originalDepartments: any[] = [];
  newDepartmentName = '';
  isSubmitting = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show'] && this.show) {
      this.companyName = this.initialCompanyName || '';
      this.departmentsList = this.initialDepartments ? JSON.parse(JSON.stringify(this.initialDepartments)) : [];
      this.originalDepartments = JSON.parse(JSON.stringify(this.departmentsList));
      this.newDepartmentName = '';
      this.isSubmitting = false;
    }
  }

  closeModal() {
    this.closed.emit();
  }

  addDepartmentToList() {
    if (this.newDepartmentName.trim()) {
      this.departmentsList.push({ name: this.newDepartmentName.trim() });
      this.newDepartmentName = '';
    }
  }

  removeDepartmentFromList(index: number) {
    this.departmentsList.splice(index, 1);
  }

  async saveCompany() {
    if (this.isSubmitting) return;
    if (!this.companyName.trim()) {
      Dialog.alert('الرجاء إدخال اسم الشركة', 'تنبيه', 'info');
      return;
    }
    
    this.isSubmitting = true;
    try {
      if (this.editingCompanyId) {
        // --- EDIT MODE ---
        await this.adminService.updateCompany(this.editingCompanyId, this.companyName).toPromise();
        
        const currentDeptIds = this.departmentsList.filter(d => d.id).map(d => d.id);
        const originalDeptIds = this.originalDepartments.map(d => d.id);
        
        const deptsToDelete = originalDeptIds.filter(id => !currentDeptIds.includes(id));
        if (deptsToDelete.length > 0) {
          await Promise.all(deptsToDelete.map(id => this.adminService.deleteDepartment(id).toPromise()));
        }
        
        const validDepts = this.departmentsList.filter(d => d.name.trim());
        const deptPromises = validDepts.map(dept => {
          if (dept.id) {
            return this.adminService.updateDepartment(dept.id, dept.name.trim()).toPromise();
          } else {
            return this.adminService.createDepartment(this.editingCompanyId!, dept.name.trim()).toPromise();
          }
        });
        
        await Promise.all(deptPromises);
        Dialog.alert('تم تعديل الشركة والأقسام بنجاح!', 'نجاح', 'success');
      } else {
        // --- CREATE MODE ---
        const comp = await this.adminService.createCompany(this.companyName).toPromise();
        const companyId = comp.id || comp.data?.id; // fallback logic
        
        const validDepts = this.departmentsList.filter(d => d.name.trim());
        if (companyId) {
          const deptPromises = validDepts.map(dept => 
            this.adminService.createDepartment(companyId, dept.name.trim()).toPromise()
          );
          await Promise.all(deptPromises);
        }
        Dialog.alert('تم إنشاء الشركة بنجاح!', 'نجاح', 'success');
      }
      
      this.isSubmitting = false;
      this.saved.emit();
      this.closeModal();
    } catch (err: any) {
      this.isSubmitting = false;
      console.error('Error saving company', err);
      Dialog.alert('حدث خطأ أثناء حفظ الشركة.', 'خطأ', 'error');
    }
  }
}
