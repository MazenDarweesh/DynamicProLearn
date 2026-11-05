import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CopilotTopFilterBarComponent } from './copilot-top-filter-bar.component';
import { CopilotService, StudentCopilotFilterData, CopilotFilterState } from '../../../core/services/ai-copilot/copilot.service';
import { of } from 'rxjs';
import { SimpleChange } from '@angular/core';

describe('CopilotTopFilterBarComponent', () => {
  let component: CopilotTopFilterBarComponent;
  let fixture: ComponentFixture<CopilotTopFilterBarComponent>;
  let mockCopilotService: jasmine.SpyObj<CopilotService>;

  const mockFilterData: StudentCopilotFilterData = {
    modules: [
      {
        id: 'mod-1',
        title: 'موديول التصنيع',
        code: '',
        units: [
          {
            id: 'unit-1',
            title: 'الوحدة الأولى',
            lessons: [
              { id: 'lesson-1', title: 'مقدمة التصنيع', levelId: 'lvl-1', typeId: 'type-1' },
              { id: 'lesson-2', title: 'أوامر التشغيل', levelId: 'lvl-2', typeId: 'type-1' }
            ]
          }
        ]
      }
    ],
    levels: [
      { id: 'lvl-1', name: 'مبتدئ', sortOrder: 1 },
      { id: 'lvl-2', name: 'متوسط', sortOrder: 2 }
    ],
    types: [
      { id: 'type-1', name: 'فيديو', sortOrder: 0 }
    ]
  };

  beforeEach(async () => {
    mockCopilotService = jasmine.createSpyObj('CopilotService', ['getCopilotFilters']);
    mockCopilotService.getCopilotFilters.and.returnValue(of(mockFilterData));

    await TestBed.configureTestingModule({
      imports: [CopilotTopFilterBarComponent],
      providers: [
        { provide: CopilotService, useValue: mockCopilotService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CopilotTopFilterBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load filter hierarchy on init', () => {
    expect(component).toBeTruthy();
    expect(component.filterData).toEqual(mockFilterData);
    expect(mockCopilotService.getCopilotFilters).toHaveBeenCalled();
  });

  it('should switch scope and emit updated filter state', () => {
    spyOn(component.filterChange, 'emit');

    component.setScope('module');
    expect(component.currentFilter.scope).toBe('module');
    expect(component.currentFilter.moduleId).toBe('mod-1');
    expect(component.filterChange.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      scope: 'module',
      moduleId: 'mod-1'
    }));
  });

  it('should cascade selects when moving from module to unit to lesson', () => {
    component.setScope('lesson');
    expect(component.availableUnits.length).toBe(1);
    expect(component.availableLessons.length).toBe(2);
    expect(component.currentFilter.unitId).toBe('unit-1');
    expect(component.currentFilter.lessonId).toBe('lesson-1');
  });

  it('should toggle level and type filter chips', () => {
    spyOn(component.filterChange, 'emit');

    // Toggle level on
    component.toggleLevel('lvl-1');
    expect(component.currentFilter.levelId).toBe('lvl-1');

    // Toggle same level off
    component.toggleLevel('lvl-1');
    expect(component.currentFilter.levelId).toBeUndefined();

    // Toggle type
    component.toggleType('type-1');
    expect(component.currentFilter.typeId).toBe('type-1');
  });

  it('should reset all filters when resetAllFilters is called', () => {
    spyOn(component.filterChange, 'emit');

    component.setScope('lesson');
    component.toggleLevel('lvl-1');
    component.resetAllFilters();

    expect(component.currentFilter.scope).toBe('all');
    expect(component.currentFilter.moduleId).toBeUndefined();
    expect(component.currentFilter.unitId).toBeUndefined();
    expect(component.currentFilter.lessonId).toBeUndefined();
    expect(component.currentFilter.levelId).toBeUndefined();
    expect(component.filterChange.emit).toHaveBeenCalledWith(jasmine.objectContaining({
      scope: 'all'
    }));
  });

  it('should auto-detect and lock onto activeLessonId input', () => {
    spyOn(component.filterChange, 'emit');

    component.activeLessonId = 'lesson-2';
    component.ngOnChanges({
      activeLessonId: new SimpleChange(null, 'lesson-2', true)
    });

    expect(component.currentFilter.scope).toBe('lesson');
    expect(component.currentFilter.moduleId).toBe('mod-1');
    expect(component.currentFilter.unitId).toBe('unit-1');
    expect(component.currentFilter.lessonId).toBe('lesson-2');
    expect(component.isAutoDetectedLesson).toBeTrue();
  });
});
