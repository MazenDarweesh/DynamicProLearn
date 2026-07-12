import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminModuleDto, LookupDto } from '../../../core/services/admin.service';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';

@Component({
  selector: 'app-content-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent],
  templateUrl: './content-builder.html',
  styleUrls: ['./content-builder.css']
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

  onModuleChange() {
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

  isAddingUnit = false;
  newUnitName = '';
  addingLessonUnitId: string | null = null;
  newLessonTitle = '';

  addUnit() {
    this.isAddingUnit = true;
    this.newUnitName = '';
  }

  cancelAddUnit() {
    this.isAddingUnit = false;
    this.newUnitName = '';
  }

  saveNewUnit() {
    if (!this.isAddingUnit) return;
    if (!this.selectedModuleId) {
      this.isAddingUnit = false;
      return;
    }
    const name = this.newUnitName.trim();
    if (!name) {
      this.isAddingUnit = false;
      return;
    }
    
    this.isAddingUnit = false;

    this.adminService.createUnit(this.selectedModuleId, name).subscribe({
      next: (newUnit: any) => {
        newUnit.lessons = [];
        this.units.push(newUnit);
        this.newUnitName = '';
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

  startAddLesson(unit: any) {
    this.addingLessonUnitId = unit.id;
    this.newLessonTitle = '';
  }

  cancelAddLesson() {
    this.addingLessonUnitId = null;
    this.newLessonTitle = '';
  }

  saveNewLesson(unit: any) {
    if (this.addingLessonUnitId !== unit.id) return;
    const title = this.newLessonTitle.trim();
    if (!title) {
      this.addingLessonUnitId = null;
      return;
    }
    
    this.addingLessonUnitId = null;

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
        this.newLessonTitle = '';
      },
      error: (err) => Dialog.alert('فشل إنشاء الدرس: ' + (err.error?.detail || err.message), 'خطأ', 'error')
    });
  }

  async deleteLesson(unit: any, lesson: any, event: Event) {
    event.stopPropagation();
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
