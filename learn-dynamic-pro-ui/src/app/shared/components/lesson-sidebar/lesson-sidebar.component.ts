import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lesson-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lesson-sidebar.component.html',
  styleUrls: ['./lesson-sidebar.component.css']
})
export class LessonSidebarComponent {
  @Input() data: any[] = [];
  @Input() type: 'units' | 'levels' = 'units';
  @Input() activeLessonId?: string;
  @Input() isLoading: boolean = false;
  
  @Output() lessonSelected = new EventEmitter<string>();

  onLessonSelect(lessonId: string) {
    this.lessonSelected.emit(lessonId);
  }
}
