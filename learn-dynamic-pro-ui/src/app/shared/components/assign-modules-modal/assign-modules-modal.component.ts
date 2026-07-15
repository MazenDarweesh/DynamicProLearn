import { Component, EventEmitter, Input, Output, OnInit, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-assign-modules-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assign-modules-modal.component.html',
  styleUrls: ['./assign-modules-modal.component.css']
})
export class AssignModulesModalComponent implements OnInit, OnChanges {
  @Input() show: boolean = false;
  @Input() companyName: string = '';
  @Input() departmentName: string = '';
  @Input() departmentId: string = '';

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private adminService = inject(AdminService);

  modules: any[] = [];
  allLevels: any[] = [];
  allTypes: any[] = [];

  assignedModules: any[] = [];
  pendingAssignedModuleIds = new Set<string>();
  moduleSelections: { [moduleId: string]: { levelIds: string[], typeIds: string[] } } = {};
  isSubmitting = false;

  ngOnInit() {
    this.adminService.getModules(1, 1000).subscribe(res => this.modules = res);
    this.adminService.getLevels().subscribe(res => this.allLevels = res);
    this.adminService.getTypes().subscribe(res => this.allTypes = res);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['show'] && this.show && this.departmentId) {
      this.loadAssignments();
    }
  }

  loadAssignments() {
    this.pendingAssignedModuleIds.clear();
    this.moduleSelections = {};
    this.adminService.getDepartmentAssignments(this.departmentId, 1, 1000).subscribe(assignments => {
      this.assignedModules = assignments;
      assignments.forEach((a: any) => {
        this.pendingAssignedModuleIds.add(a.moduleId);
        this.moduleSelections[a.moduleId] = {
          levelIds: a.levelIds || [],
          typeIds: a.typeIds || []
        };
      });
    });
  }

  closeModal() {
    this.closed.emit();
  }

  isModuleAssigned(moduleId: string): boolean {
    return this.pendingAssignedModuleIds.has(moduleId);
  }

  toggleModuleAssignment(moduleId: string, event: any) {
    if (event.target.checked) {
      this.pendingAssignedModuleIds.add(moduleId);
      if (!this.moduleSelections[moduleId]) {
        this.moduleSelections[moduleId] = { levelIds: [], typeIds: [] };
      }
    } else {
      this.pendingAssignedModuleIds.delete(moduleId);
      delete this.moduleSelections[moduleId];
    }
  }

  isFilterSelected(moduleId: string, filterType: 'level'|'type', id: string): boolean {
    const selection = this.moduleSelections[moduleId];
    if (!selection) return false;
    return filterType === 'level' ? selection.levelIds.includes(id) : selection.typeIds.includes(id);
  }

  toggleFilterSelection(moduleId: string, filterType: 'level'|'type', id: string, event: any) {
    if (!this.moduleSelections[moduleId]) this.moduleSelections[moduleId] = { levelIds: [], typeIds: [] };
    const list = filterType === 'level' ? this.moduleSelections[moduleId].levelIds : this.moduleSelections[moduleId].typeIds;
    
    if (event.target.checked) list.push(id);
    else {
      const idx = list.indexOf(id);
      if (idx > -1) list.splice(idx, 1);
    }
  }

  async saveModuleAssignments() {
    this.isSubmitting = true;
    const currentAssignedModuleIds = new Set(this.assignedModules.map(a => a.moduleId));
    
    // Modules to remove (unchecked)
    const toRemove = this.assignedModules.filter(a => !this.pendingAssignedModuleIds.has(a.moduleId));

    try {
      // Remove deselected modules
      for (const assignment of toRemove) {
        await new Promise<void>((resolve, reject) => {
          this.adminService.removeAssignment(assignment.id).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }

      // Add or update all currently selected modules (backend will overwrite existing to prevent duplicates)
      for (const moduleId of this.pendingAssignedModuleIds) {
        await new Promise<void>((resolve, reject) => {
          const selection = this.moduleSelections[moduleId] || { levelIds: [], typeIds: [] };
          this.adminService.assignModule(moduleId, this.departmentId, selection.levelIds, selection.typeIds).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }
      
      this.isSubmitting = false;
      Dialog.alert('تم حفظ إسنادات الموديولات بنجاح!', 'نجاح', 'success');
      this.saved.emit();
      this.closeModal();
    } catch (err: any) {
      this.isSubmitting = false;
      console.error('Error saving assignments', err);
      Dialog.alert('حدث خطأ أثناء حفظ الإسنادات.', 'خطأ', 'error');
    }
  }
}
