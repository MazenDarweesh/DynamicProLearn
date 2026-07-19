import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lesson-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lesson-sidebar.component.html',
  styleUrls: ['./lesson-sidebar.component.css']
})
export class LessonSidebarComponent implements OnChanges {
  @Input() data: any[] = [];
  @Input() type: 'units' | 'levels' = 'units';
  @Input() activeLessonId?: string;
  @Input() isLoading: boolean = false;
  
  @Output() lessonSelected = new EventEmitter<string>();

  filteredData: any[] = [];
  
  uniqueLevels: string[] = [];
  uniqueTypes: string[] = [];
  
  selectedLevel: string = '';
  selectedType: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data) {
      this.extractFilters();
      this.applyFilters();
    }
  }

  extractFilters() {
    const levels = new Set<string>();
    const types = new Set<string>();

    this.data.forEach(group => {
      if (group.lessons) {
        group.lessons.forEach((l: any) => {
          if (l.levelLabel) levels.add(l.levelLabel);
          if (l.typeLabel) types.add(l.typeLabel);
        });
      }
    });

    this.uniqueLevels = Array.from(levels);
    this.uniqueTypes = Array.from(types);
  }

  applyFilters() {
    if (!this.selectedLevel && !this.selectedType) {
      this.filteredData = this.data;
      return;
    }

    this.filteredData = this.data.map(group => {
      if (!group.lessons) return group;
      
      const filteredLessons = group.lessons.filter((l: any) => {
        const matchLevel = this.selectedLevel ? l.levelLabel === this.selectedLevel : true;
        const matchType = this.selectedType ? l.typeLabel === this.selectedType : true;
        return matchLevel && matchType;
      });

      return {
        ...group,
        lessons: filteredLessons
      };
    }).filter(group => group.lessons && group.lessons.length > 0);
  }

  onLessonSelect(lessonId: string) {
    this.lessonSelected.emit(lessonId);
  }
}
