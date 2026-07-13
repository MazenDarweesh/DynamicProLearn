import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminModuleDto } from '../../../../../core/models/admin.models';

@Component({
  selector: 'app-content-tree',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-tree.component.html',
  styleUrls: ['./content-tree.component.css']
})
export class ContentTreeComponent {
  @Input() modules: AdminModuleDto[] = [];
  @Input() selectedModuleId: string | null = null;
  @Input() isLoadingTree = false;
  @Input() isSaving = false;
  @Input() units: any[] = [];
  @Input() selectedLesson: any = null;

  @Output() moduleChange = new EventEmitter<string>();
  @Output() saveAll = new EventEmitter<void>();
  @Output() createUnit = new EventEmitter<string>();
  @Output() deleteUnit = new EventEmitter<any>();
  @Output() createLesson = new EventEmitter<{unit: any, title: string}>();
  @Output() deleteLesson = new EventEmitter<{unit: any, lesson: any}>();
  @Output() selectLesson = new EventEmitter<any>();

  isAddingUnit = false;
  newUnitName = '';
  addingLessonUnitId: string | null = null;
  newLessonTitle = '';

  onModuleChange(moduleId: string) {
    this.moduleChange.emit(moduleId);
  }

  onSaveAll() {
    this.saveAll.emit();
  }

  startAddUnit() {
    this.isAddingUnit = true;
    this.newUnitName = '';
  }

  cancelAddUnit() {
    this.isAddingUnit = false;
    this.newUnitName = '';
  }

  onSaveNewUnit() {
    if (!this.isAddingUnit) return;
    const name = this.newUnitName.trim();
    if (name) {
      this.createUnit.emit(name);
    }
    this.isAddingUnit = false;
    this.newUnitName = '';
  }

  onDeleteUnit(unit: any) {
    this.deleteUnit.emit(unit);
  }

  startAddLesson(unit: any) {
    this.addingLessonUnitId = unit.id;
    this.newLessonTitle = '';
  }

  cancelAddLesson() {
    this.addingLessonUnitId = null;
    this.newLessonTitle = '';
  }

  onSaveNewLesson(unit: any) {
    if (this.addingLessonUnitId !== unit.id) return;
    const title = this.newLessonTitle.trim();
    if (title) {
      this.createLesson.emit({ unit, title });
    }
    this.addingLessonUnitId = null;
    this.newLessonTitle = '';
  }

  onDeleteLesson(unit: any, lesson: any, event: Event) {
    event.stopPropagation();
    this.deleteLesson.emit({ unit, lesson });
  }

  onSelectLesson(lesson: any) {
    this.selectLesson.emit(lesson);
  }
}
