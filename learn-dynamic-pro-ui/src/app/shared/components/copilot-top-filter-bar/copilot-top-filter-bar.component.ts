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

  setScope(scope: 'all' | 'module' | 'unit' | 'lesson') {
    if (this.currentFilter.scope === scope) return;

    this.currentFilter.scope = scope;
    this.isAutoDetectedLesson = false;

    if (scope === 'all') {
      this.currentFilter.moduleId = undefined;
      this.currentFilter.unitId = undefined;
      this.currentFilter.lessonId = undefined;
      this.availableUnits = [];
      this.availableLessons = [];
    } else if (scope === 'module') {
      this.currentFilter.unitId = undefined;
      this.currentFilter.lessonId = undefined;
      if (!this.currentFilter.moduleId && this.filterData?.modules.length) {
        this.currentFilter.moduleId = this.filterData.modules[0].id;
      }
      this.updateUnits();
    } else if (scope === 'unit') {
      this.currentFilter.lessonId = undefined;
      if (!this.currentFilter.moduleId && this.filterData?.modules.length) {
        this.currentFilter.moduleId = this.filterData.modules[0].id;
      }
      this.updateUnits();
      if (!this.currentFilter.unitId && this.availableUnits.length) {
        this.currentFilter.unitId = this.availableUnits[0].id;
      }
      this.updateLessons();
    } else if (scope === 'lesson') {
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
      levelId: undefined,
      typeId: undefined
    };
    this.isAutoDetectedLesson = false;
    this.availableUnits = [];
    this.availableLessons = [];
    this.emitChange();
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
    return this.currentFilter.scope !== 'all' ||
      !!this.currentFilter.levelId ||
      !!this.currentFilter.typeId;
  }
}
