import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpandableTableComponent } from '../expandable-table/expandable-table.component';
import { ProgressBarComponent } from '../progress-bar/progress-bar.component';

@Component({
  selector: 'app-curriculum-viewer',
  standalone: true,
  imports: [CommonModule, ExpandableTableComponent, ProgressBarComponent],
  templateUrl: './curriculum-viewer.component.html',
  styleUrls: ['./curriculum-viewer.component.css']
})
export class CurriculumViewerComponent {
  @Input() modules: any[] = [];
  @Input() isAllExpanded: boolean = false;
  @Input() isLoading: boolean = false;
  
  // Flags for what mode we are in
  @Input() isDepartmentView: boolean = true;
  @Input() isStudentView: boolean = false;
  @Input() isTesterView: boolean = false;

  @Output() onMarkLessonComplete = new EventEmitter<string>();
  @Output() onUnmarkLessonComplete = new EventEmitter<string>();

  markLessonComplete(lessonId: string): void {
    this.onMarkLessonComplete.emit(lessonId);
  }

  unmarkLessonComplete(lessonId: string): void {
    this.onUnmarkLessonComplete.emit(lessonId);
  }
}
