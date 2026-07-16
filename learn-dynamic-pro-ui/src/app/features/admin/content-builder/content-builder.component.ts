import { Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AdminModuleDto, LookupDto } from '../../../core/models/admin.models';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { AdminActionButtonComponent } from '../../../shared/components/admin-action-button/admin-action-button.component';
import { AdminModalComponent } from '../../../shared/components/admin-modal/admin-modal.component';
import { ContentTreeComponent } from './components/content-tree/content-tree.component';
import { ModuleEditorComponent } from './components/module-editor/module-editor.component';
import { LessonEditorComponent } from './components/lesson-editor/lesson-editor.component';

@Component({
  selector: 'app-content-builder',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    AdminHeaderComponent, AdminActionButtonComponent, AdminModalComponent,
    ContentTreeComponent, ModuleEditorComponent, LessonEditorComponent
  ],
  templateUrl: './content-builder.component.html',
  styleUrls: ['./content-builder.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ContentBuilderComponent implements OnInit {
  private router = inject(Router);
  private adminService = inject(AdminService);
  
  modules: AdminModuleDto[] = [];
  selectedModuleId: string | null = null;
  
  units: any[] = [];
  selectedLesson: any | null = null;
  selectedModule: AdminModuleDto | null = null;
  
  lookups: { levels: LookupDto[], types: LookupDto[] } = { levels: [], types: [] };
  
  isLoadingTree = false;
  isSaving = false;

  ngOnInit() {
    this.loadLookups();
    this.loadModules();
  }

  loadLookups() {
    this.adminService.getLevels().subscribe({
      next: (levels) => this.lookups.levels = levels,
      error: () => console.error('Failed to load levels')
    });
    this.adminService.getTypes().subscribe({
      next: (types) => this.lookups.types = types,
      error: () => console.error('Failed to load types')
    });
  }

  loadModules() {
    this.adminService.getModules().subscribe({
      next: (data) => {
        this.modules = data;
      },
      error: () => console.error('Failed to load modules')
    });
  }

  onModuleChange(moduleId: string) {
    this.selectedModuleId = moduleId;
    if (!this.selectedModuleId) {
      this.selectedModule = null;
      return;
    }
    this.selectedModule = this.modules.find(m => m.id === this.selectedModuleId) || null;
    this.loadTree(this.selectedModuleId);
  }

  loadTree(moduleId: string) {
    this.isLoadingTree = true;
    this.selectedLesson = null;
    this.units = [];

    this.adminService.getUnits(moduleId).subscribe({
      next: (unitsData) => {
        let loadedUnits = 0;
        if (unitsData.length === 0) {
          this.isLoadingTree = false;
          return;
        }

        unitsData.forEach(u => {
          u.lessons = [];
          this.units.push(u);
          
          this.adminService.getLessons(u.id).subscribe({
            next: (lessonsData) => {
              u.lessons = lessonsData;
              loadedUnits++;
              if (loadedUnits === unitsData.length) {
                // sort units
                this.units.sort((a, b) => a.orderIndex - b.orderIndex);
                this.units.forEach(un => un.lessons.sort((a: any, b: any) => {
                  if (a.levelSortOrder !== b.levelSortOrder) {
                    return a.levelSortOrder - b.levelSortOrder;
                  }
                  return a.levelOrderIndex - b.levelOrderIndex;
                }));
                this.isLoadingTree = false;
              }
            },
            error: () => {
              loadedUnits++;
              if (loadedUnits === unitsData.length) this.isLoadingTree = false;
            }
          });
        });
      },
      error: () => this.isLoadingTree = false
    });
  }

  async deleteModule(moduleId: string) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف هذا الموديول بالكامل؟ (سيتم حذف جميع الوحدات والدروس المرتبطة به!)', 'تأكيد الحذف النهائي');
    if (!ok) return;

    this.adminService.deleteModule(moduleId).subscribe({
      next: () => {
        this.modules = this.modules.filter(m => m.id !== moduleId);
        if (this.selectedModuleId === moduleId) {
          this.selectedModuleId = null;
          this.selectedModule = null;
          this.units = [];
          this.selectedLesson = null;
        }
        Dialog.alert('تم حذف الموديول بنجاح.', 'نجاح', 'success');
      },
      error: (err) => Dialog.alert('فشل حذف الموديول: ' + (err.error?.detail || err.message), 'خطأ', 'error')
    });
  }

  showAddModuleModal = false;
  newModuleName = '';
  isSubmittingModal = false;

  openAddModuleModal() {
    this.showAddModuleModal = true;
    this.newModuleName = '';
    this.isSubmittingModal = false;
  }

  closeAddModuleModal() {
    this.showAddModuleModal = false;
    this.newModuleName = '';
  }

  submitNewModule() {
    if (!this.newModuleName.trim()) return;
    this.isSubmittingModal = true;
    
    const payload = {
      name: this.newModuleName.trim(),
      description: ''
    };

    this.adminService.createModule(payload.name, payload.description).subscribe({
      next: (newMod) => {
        this.modules.push(newMod);
        this.closeAddModuleModal();
        this.onModuleChange(newMod.id);
      },
      error: (err) => {
        this.isSubmittingModal = false;
        Dialog.alert('فشل إنشاء الموديول: ' + (err.error?.detail || err.message), 'خطأ', 'error');
      }
    });
  }

  createUnit(name: string) {
    if (!this.selectedModuleId) return;
    
    this.adminService.createUnit(this.selectedModuleId, name).subscribe({
      next: (newUnit: any) => {
        newUnit.lessons = [];
        this.units.push(newUnit);
      },
      error: (err: any) => Dialog.alert('فشل إنشاء الوحدة: ' + (err.error?.detail || err.message), 'خطأ', 'error')
    });
  }

  async deleteUnit(unit: any) {
    const ok = await Dialog.confirm(`هل أنت متأكد من حذف الوحدة: ${unit.name}؟`, 'تأكيد الحذف');
    if (!ok) return;
    this.adminService.deleteUnit(unit.id).subscribe({
      next: () => {
        this.units = this.units.filter(u => u.id !== unit.id);
        if (this.selectedLesson && this.selectedLesson.unitId === unit.id) {
          this.selectedLesson = null;
        }
      },
      error: (err) => Dialog.alert('فشل الحذف: ' + (err.error?.detail || err.message), 'خطأ', 'error')
    });
  }

  createLesson(event: {unit: any, title: string}) {
    const { unit, title } = event;
    const payload = {
      unitId: unit.id,
      title: title,
      description: '',
      videoUrl: '',
      pdfUrl: '',
      externalLink: '',
      levelId: this.lookups.levels.length ? this.lookups.levels[0].id : '00000000-0000-0000-0000-000000000001',
      typeId: this.lookups.types.length ? this.lookups.types[0].id : '00000000-0000-0000-0000-000000000001',
      orderIndex: unit.lessons.length + 1,
      levelOrderIndex: 1
    };

    this.adminService.createLesson(payload).subscribe({
      next: (newLesson) => {
        unit.lessons.push(newLesson);
        this.selectLesson(newLesson);
      },
      error: (err) => Dialog.alert('فشل إنشاء الدرس: ' + (err.error?.detail || err.message), 'خطأ', 'error')
    });
  }

  async deleteLesson(event: {unit: any, lesson: any}) {
    const { unit, lesson } = event;
    const ok = await Dialog.confirm(`هل أنت متأكد من حذف الدرس: ${lesson.title}؟`, 'تأكيد الحذف');
    if (!ok) return;
    
    this.adminService.deleteLesson(lesson.id).subscribe({
      next: () => {
        unit.lessons = unit.lessons.filter((l: any) => l.id !== lesson.id);
        if (this.selectedLesson && this.selectedLesson.id === lesson.id) {
          this.selectedLesson = null;
        }
      },
      error: (err) => Dialog.alert('فشل الحذف: ' + (err.error?.detail || err.message), 'خطأ', 'error')
    });
  }

  selectLesson(lesson: any) {
    this.selectedLesson = lesson;
  }

  async saveAll() {
    if (!this.selectedModuleId) return;
    this.isSaving = true;

    try {
      // Update module details
      if (this.selectedModule) {
        await this.adminService.updateModule(this.selectedModule.id, this.selectedModule.name, this.selectedModule.description).toPromise();
      }

      // Update units
      const unitPromises = this.units.map((u, index) => 
        this.adminService.updateUnit(u.id, u.name, index + 1).toPromise()
      );
      await Promise.all(unitPromises);

      // Update lessons
      const lessonPromises: Promise<any>[] = [];
      this.units.forEach(u => {
        u.lessons.forEach((l: any, lIndex: number) => {
          const payload = {
            title: l.title,
            description: l.description || '',
            videoUrl: l.videoUrl || '',
            pdfUrl: l.pdfUrl || '',
            externalLink: l.externalLink || '',
            levelId: l.levelId,
            typeId: l.typeId,
            orderIndex: l.orderIndex && l.orderIndex >= 1 ? l.orderIndex : lIndex + 1,
            levelOrderIndex: l.levelOrderIndex && l.levelOrderIndex >= 1 ? l.levelOrderIndex : 1
          };
          lessonPromises.push(this.adminService.updateLesson(l.id, payload).toPromise());
        });
      });
      await Promise.all(lessonPromises);

      Dialog.alert('تم حفظ جميع التعديلات بنجاح! ✅', 'نجاح', 'success');
    } catch (err: any) {
      Dialog.alert('حدث خطأ أثناء الحفظ: ' + (err.error?.detail || err.message), 'خطأ', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}
