import { Component, OnInit, OnChanges, SimpleChanges, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CopilotService,
  StudentCopilotFilterData,
  CopilotFilterModule,
  CopilotFilterUnit,
  CopilotFilterLesson,
  CopilotFilterOption,
  CopilotFilterState
} from '../../../core/services/copilot.service';

@Component({
  selector: 'app-copilot-top-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './copilot-top-filter-bar.component.html',
  styleUrls: ['./copilot-top-filter-bar.component.css']
})
export class CopilotTopFilterBarComponent implements OnInit, OnChanges {
  private copilotService = inject(CopilotService);

  @Input() activeLessonId?: string;
  @Input() isCollapsed: boolean = false;
  @Output() filterChange = new EventEmitter<CopilotFilterState>();
  @Output() toggleCollapse = new EventEmitter<boolean>();

  filterData: StudentCopilotFilterData | null = null;
  isLoading = false;
  loadError = false;

  currentFilter: CopilotFilterState = {
    scope: 'all'
  };

  selectedLessonsList: { id: string; title: string; moduleName: string }[] = [];
  lessonSearchQuery: string = '';

  isAutoDetectedLesson = false;

  availableUnits: CopilotFilterUnit[] = [];
  availableLessons: CopilotFilterLesson[] = [];

  ngOnInit() {
    this.loadFilters();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['activeLessonId'] && this.activeLessonId && this.filterData) {
      this.applyAutoDetectedLesson(this.activeLessonId);
    }
  }

  loadFilters(force = false) {
    this.isLoading = true;
    this.loadError = false;
    this.copilotService.getCopilotFilters(force).subscribe({
      next: (data) => {
        this.filterData = data;
        this.isLoading = false;
        if (this.activeLessonId) {
          this.applyAutoDetectedLesson(this.activeLessonId);
        } else {
          this.emitChange();
        }
      },
      error: (err) => {
        console.error('[CopilotFilterBar] Failed to load filter hierarchy', err);
        this.isLoading = false;
        this.loadError = true;
      }
    });
  }

  setScope(scope: 'all' | 'module' | 'unit' | 'lesson' | 'lessons') {
    if (this.currentFilter.scope === scope) return;

    this.currentFilter.scope = scope;
    this.isAutoDetectedLesson = false;

    if (scope === 'all') {
      this.currentFilter.moduleId = undefined;
      this.currentFilter.unitId = undefined;
      this.currentFilter.lessonId = undefined;
      this.currentFilter.lessonIds = undefined;
      this.availableUnits = [];
      this.availableLessons = [];
    } else if (scope === 'module') {
      this.currentFilter.unitId = undefined;
      this.currentFilter.lessonId = undefined;
      this.currentFilter.lessonIds = undefined;
      if (!this.currentFilter.moduleId && this.filterData?.modules.length) {
        this.currentFilter.moduleId = this.filterData.modules[0].id;
      }
      this.updateUnits();
    } else if (scope === 'unit') {
      this.currentFilter.lessonId = undefined;
      this.currentFilter.lessonIds = undefined;
      if (!this.currentFilter.moduleId && this.filterData?.modules.length) {
        this.currentFilter.moduleId = this.filterData.modules[0].id;
      }
      this.updateUnits();
      if (!this.currentFilter.unitId && this.availableUnits.length) {
        this.currentFilter.unitId = this.availableUnits[0].id;
      }
      this.updateLessons();
    } else if (scope === 'lesson') {
      this.currentFilter.lessonIds = undefined;
      if (!this.currentFilter.moduleId && this.filterData?.modules.length) {
        this.currentFilter.moduleId = this.filterData.modules[0].id;
      }
      this.updateUnits();
      if (!this.currentFilter.unitId && this.availableUnits.length) {
        this.currentFilter.unitId = this.availableUnits[0].id;
      }
      this.updateLessons();
      if (!this.currentFilter.lessonId && this.availableLessons.length) {
        this.currentFilter.lessonId = this.availableLessons[0].id;
      }
    } else if (scope === 'lessons') {
      if (this.currentFilter.lessonId && this.selectedLessonsList.length === 0) {
        const activeTitle = this.selectedLessonTitle;
        const activeModule = this.selectedModuleName;
        if (activeTitle) {
          this.selectedLessonsList.push({
            id: this.currentFilter.lessonId,
            title: activeTitle,
            moduleName: activeModule
          });
        }
      }
      this.currentFilter.lessonIds = this.selectedLessonsList.map(l => l.id);
    }

    this.emitChange();
  }

  onModuleChange(moduleId: string) {
    this.currentFilter.moduleId = moduleId;
    this.isAutoDetectedLesson = false;
    this.updateUnits();

    if (this.currentFilter.scope === 'unit' || this.currentFilter.scope === 'lesson') {
      this.currentFilter.unitId = this.availableUnits.length ? this.availableUnits[0].id : undefined;
      this.updateLessons();
    }

    if (this.currentFilter.scope === 'lesson') {
      this.currentFilter.lessonId = this.availableLessons.length ? this.availableLessons[0].id : undefined;
    }

    this.emitChange();
  }

  onUnitChange(unitId: string) {
    this.currentFilter.unitId = unitId;
    this.isAutoDetectedLesson = false;
    this.updateLessons();

    if (this.currentFilter.scope === 'lesson') {
      this.currentFilter.lessonId = this.availableLessons.length ? this.availableLessons[0].id : undefined;
    }

    this.emitChange();
  }

  onLessonChange(lessonId: string) {
    this.currentFilter.lessonId = lessonId;
    this.isAutoDetectedLesson = false;
    this.emitChange();
  }

  toggleLevel(levelId?: string) {
    if (this.currentFilter.levelId === levelId || !levelId) {
      this.currentFilter.levelId = undefined;
    } else {
      this.currentFilter.levelId = levelId;
    }
    this.emitChange();
  }

  toggleType(typeId?: string) {
    if (this.currentFilter.typeId === typeId || !typeId) {
      this.currentFilter.typeId = undefined;
    } else {
      this.currentFilter.typeId = typeId;
    }
    this.emitChange();
  }

  resetAllFilters() {
    this.currentFilter = {
      scope: 'all',
      moduleId: undefined,
      unitId: undefined,
      lessonId: undefined,
      lessonIds: undefined,
      levelId: undefined,
      typeId: undefined
    };
    this.selectedLessonsList = [];
    this.lessonSearchQuery = '';
    this.isAutoDetectedLesson = false;
    this.availableUnits = [];
    this.availableLessons = [];
    this.emitChange();
  }

  addLessonToMultiSelect(lesson: CopilotFilterLesson, moduleName: string) {
    if (this.selectedLessonsList.some(l => l.id === lesson.id)) return;
    this.selectedLessonsList.push({
      id: lesson.id,
      title: lesson.title,
      moduleName: moduleName
    });
    this.currentFilter.lessonIds = this.selectedLessonsList.map(l => l.id);
    this.emitChange();
  }

  removeLessonFromMultiSelect(lessonId: string) {
    this.selectedLessonsList = this.selectedLessonsList.filter(l => l.id !== lessonId);
    this.currentFilter.lessonIds = this.selectedLessonsList.map(l => l.id);
    this.emitChange();
  }

  clearAllSelectedLessons() {
    this.selectedLessonsList = [];
    this.currentFilter.lessonIds = [];
    this.emitChange();
  }

  isLessonSelected(lessonId: string): boolean {
    return this.selectedLessonsList.some(l => l.id === lessonId);
  }

  toggleLessonSelection(lesson: CopilotFilterLesson, moduleName: string) {
    if (this.isLessonSelected(lesson.id)) {
      this.removeLessonFromMultiSelect(lesson.id);
    } else {
      this.addLessonToMultiSelect(lesson, moduleName);
    }
  }

  get filteredModulesWithLessons(): { moduleTitle: string; lessons: { lesson: CopilotFilterLesson; unitTitle: string }[] }[] {
    if (!this.filterData?.modules) return [];
    const query = (this.lessonSearchQuery || '').trim().toLowerCase();

    const results: { moduleTitle: string; lessons: { lesson: CopilotFilterLesson; unitTitle: string }[] }[] = [];

    for (const mod of this.filterData.modules) {
      const matchedLessons: { lesson: CopilotFilterLesson; unitTitle: string }[] = [];
      for (const unit of mod.units) {
        for (const lesson of unit.lessons) {
          if (!query ||
              lesson.title.toLowerCase().includes(query) ||
              mod.title.toLowerCase().includes(query) ||
              unit.title.toLowerCase().includes(query)) {
            matchedLessons.push({ lesson, unitTitle: unit.title });
          }
        }
      }
      if (matchedLessons.length > 0) {
        results.push({ moduleTitle: mod.title, lessons: matchedLessons });
      }
    }
    return results;
  }

  get selectedLessonsSummary(): string {
    if (!this.selectedLessonsList.length) return 'اختر الدروس للمقارنة';
    const count = this.selectedLessonsList.length;
    const names = this.selectedLessonsList.slice(0, 2).map(l => l.title).join('، ');
    return count > 2 ? `${count} دروس: ${names} و+${count - 2} آخرين` : `${count} دروس: ${names}`;
  }

  applyAutoDetectedLesson(lessonId: string) {
    if (!this.filterData) return;

    for (const mod of this.filterData.modules) {
      for (const unit of mod.units) {
        const lesson = unit.lessons.find(l => l.id.toLowerCase() === lessonId.toLowerCase());
        if (lesson) {
          this.currentFilter.scope = 'lesson';
          this.currentFilter.moduleId = mod.id;
          this.currentFilter.unitId = unit.id;
          this.currentFilter.lessonId = lesson.id;
          this.isAutoDetectedLesson = true;

          this.updateUnits();
          this.updateLessons();
          this.emitChange();
          return;
        }
      }
    }
  }

  detachAutoLesson() {
    this.resetAllFilters();
  }

  onToggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
    this.toggleCollapse.emit(this.isCollapsed);
  }

  private updateUnits() {
    if (!this.filterData || !this.currentFilter.moduleId) {
      this.availableUnits = [];
      return;
    }
    const mod = this.filterData.modules.find(m => m.id === this.currentFilter.moduleId);
    this.availableUnits = mod ? mod.units : [];
  }

  private updateLessons() {
    if (!this.availableUnits || !this.currentFilter.unitId) {
      this.availableLessons = [];
      return;
    }
    const unit = this.availableUnits.find(u => u.id === this.currentFilter.unitId);
    this.availableLessons = unit ? unit.lessons : [];
  }

  private emitChange() {
    this.filterChange.emit({ ...this.currentFilter });
  }

  // --- Display Helpers ---
  get selectedModuleName(): string {
    if (!this.filterData || !this.currentFilter.moduleId) return '';
    return this.filterData.modules.find(m => m.id === this.currentFilter.moduleId)?.title || '';
  }

  get selectedUnitName(): string {
    if (!this.availableUnits || !this.currentFilter.unitId) return '';
    return this.availableUnits.find(u => u.id === this.currentFilter.unitId)?.title || '';
  }

  get selectedLessonTitle(): string {
    if (!this.availableLessons || !this.currentFilter.lessonId) return '';
    return this.availableLessons.find(l => l.id === this.currentFilter.lessonId)?.title || '';
  }

  get selectedLevelName(): string {
    if (!this.filterData || !this.currentFilter.levelId) return '';
    return this.filterData.levels.find(l => l.id === this.currentFilter.levelId)?.name || '';
  }

  get selectedTypeName(): string {
    if (!this.filterData || !this.currentFilter.typeId) return '';
    return this.filterData.types.find(t => t.id === this.currentFilter.typeId)?.name || '';
  }

  hasActiveFilters(): boolean {
    if (this.currentFilter.scope === 'lessons') {
      return this.selectedLessonsList.length > 0 || !!this.currentFilter.levelId || !!this.currentFilter.typeId;
    }
    return this.currentFilter.scope !== 'all' ||
      !!this.currentFilter.levelId ||
      !!this.currentFilter.typeId;
  }
}
