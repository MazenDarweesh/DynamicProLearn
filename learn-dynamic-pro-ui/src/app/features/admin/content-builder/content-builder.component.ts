import { Component, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { AdminModuleDto, LookupDto } from '../../../core/models/admin.models';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { ContentTreeComponent } from './components/content-tree/content-tree.component';
import { ModuleEditorComponent } from './components/module-editor/module-editor.component';
import { LessonEditorComponent } from './components/lesson-editor/lesson-editor.component';

@Component({
  selector: 'app-content-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, ContentTreeComponent, ModuleEditorComponent, LessonEditorComponent],
  templateUrl: './content-builder.html',
  styleUrls: ['./content-builder.css'],
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
                this.units.forEach(un => un.lessons.sort((a: any, b: any) => a.orderIndex - b.orderIndex));
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
      levelId: this.lookups.levels.length ? this.lookups.levels[0].id : '00000000-0000-0000-0000-000000000001',
      typeId: this.lookups.types.length ? this.lookups.types[0].id : '00000000-0000-0000-0000-000000000001',
      orderIndex: unit.lessons.length + 1
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
            levelId: l.levelId,
            typeId: l.typeId,
            orderIndex: lIndex + 1
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
