import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { TesterService, LookupDto } from '../../../core/services/tester.service';
import { StudentService, UnitDto, LessonDto } from '../../../core/services/student.service';
import { Router, ActivatedRoute } from '@angular/router';

export interface UnitWithLessons extends UnitDto {
  lessons: LessonDto[];
}

export interface ModuleOverview {
  id: string;
  name: string;
  description: string;
  units: UnitWithLessons[];
}

@Component({
  selector: 'app-feedback-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="viewer-container" dir="rtl">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <button class="back-btn" (click)="goBack()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            عودة
          </button>
          <h2>{{ module?.name || 'جاري التحميل...' }}</h2>
        </div>

        <div class="module-content">
          <div class="unit-group" *ngFor="let unit of module?.units">
            <h3 class="unit-title">{{ unit.title }}</h3>
            <ul class="lesson-list">
              <li class="lesson-item" 
                  *ngFor="let lesson of unit.lessons"
                  [class.active]="lesson.id === currentLesson?.id"
                  (click)="selectLesson(lesson)">
                <div class="lesson-info">
                  <span class="status-icon" [class.completed]="lesson.isCompleted">
                    <svg *ngIf="lesson.isCompleted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <div *ngIf="!lesson.isCompleted" class="circle"></div>
                  </span>
                  <span class="lesson-title">{{ lesson.title }}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div *ngIf="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>جاري تحميل بيانات الموديول...</p>
        </div>

        <div *ngIf="!isLoading && currentLesson" class="lesson-content">
          <div class="lesson-header">
            <h1>{{ currentLesson.title }}</h1>
          </div>

          <div class="tester-panel">
            <div class="panel-heading">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <h3>تقييم جودة النظام (QA)</h3>
            </div>
            
            <form (ngSubmit)="submitFeedback()" class="feedback-form">
              <div class="form-group">
                <label>حالة النظام / التقييم (System Status):</label>
                <div class="custom-select-wrapper">
                  <select class="form-control status-select" [(ngModel)]="selectedConditionId" name="condition" required>
                    <option value="" disabled selected>-- اختر حالة التقييم المرجعية --</option>
                    <option *ngFor="let cond of conditions" [value]="cond.id">
                      {{ cond.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-group mt-4">
                <label>📝 الملاحظات الهيكلية للمختبر (أسباب المشكلة أو التفاصيل):</label>
                <textarea 
                  class="form-control" 
                  [(ngModel)]="notes" 
                  name="notes" 
                  rows="4" 
                  placeholder="اكتب ملاحظاتك التقنية أو خطوات إعادة إنتاج الخطأ هنا..." 
                  required>
                </textarea>
              </div>

              <div class="form-actions mt-4">
                <button type="submit" class="btn-submit" [disabled]="isSubmitting || !selectedConditionId || !notes">
                  <span *ngIf="isSubmitting" class="spinner-small"></span>
                  <span *ngIf="!isSubmitting">📤 اعتماد النتيجة وحفظها في قاعدة الإصدار</span>
                </button>
              </div>

              <div *ngIf="successMessage" class="alert alert-success mt-3">{{ successMessage }}</div>
              <div *ngIf="errorMessage" class="alert alert-danger mt-3">{{ errorMessage }}</div>
            </form>
          </div>
        </div>

        <div *ngIf="!isLoading && !currentLesson && module?.units?.length" class="empty-state">
          <div class="icon">👈</div>
          <p>اختر درساً من القائمة الجانبية للبدء في التقييم</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .viewer-container { display: flex; height: 100vh; background-color: var(--color-bg-main); overflow: hidden; }
    
    /* Sidebar */
    .sidebar { width: 320px; background-color: var(--color-bg-page); border-left: 1px solid var(--color-border); display: flex; flex-direction: column; }
    .sidebar-header { padding: 20px; border-bottom: 1px solid var(--color-border); }
    .back-btn { display: flex; align-items: center; gap: 8px; background: none; border: none; color: var(--color-text-secondary); cursor: pointer; font-family: inherit; font-size: 14px; margin-bottom: 15px; padding: 0; }
    .back-btn:hover { color: var(--color-primary); }
    .sidebar-header h2 { margin: 0; font-size: 18px; color: var(--color-text-primary); }
    
    .module-content { flex: 1; overflow-y: auto; padding: 20px 0; }
    .unit-group { margin-bottom: 24px; }
    .unit-title { padding: 0 20px; margin: 0 0 10px 0; font-size: 14px; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    
    .lesson-list { list-style: none; padding: 0; margin: 0; }
    .lesson-item { padding: 12px 20px; cursor: pointer; transition: all 0.2s; border-right: 3px solid transparent; }
    .lesson-item:hover { background-color: rgba(59, 110, 243, 0.05); }
    .lesson-item.active { background-color: rgba(59, 110, 243, 0.1); border-right-color: var(--color-primary); }
    
    .lesson-info { display: flex; align-items: center; gap: 12px; }
    .status-icon { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; color: var(--color-text-secondary); }
    .status-icon.completed { color: #137333; background-color: #E6F4EA; }
    .circle { width: 12px; height: 12px; border: 2px solid var(--color-border); border-radius: 50%; }
    .active .circle { border-color: var(--color-primary); }
    .lesson-title { font-size: 14px; color: var(--color-text-primary); font-weight: 500; }
    
    /* Main Content */
    .main-content { flex: 1; overflow-y: auto; padding: 40px; background-color: var(--color-bg-main); }
    .lesson-header { max-width: 800px; margin: 0 auto 40px auto; }
    .lesson-header h1 { margin: 0 0 10px 0; font-size: 32px; color: var(--color-text-primary); }
    
    .tester-panel { max-width: 800px; margin: 0 auto; background-color: var(--color-bg-page); border: 1px solid var(--color-border); border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .panel-heading { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); color: var(--color-primary); }
    .panel-heading h3 { margin: 0; font-size: 20px; color: var(--color-text-primary); }
    
    .form-group label { display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px; color: var(--color-text-primary); }
    .form-control { width: 100%; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 8px; background-color: var(--color-bg-main); color: var(--color-text-primary); font-family: inherit; font-size: 15px; transition: border-color 0.2s; }
    .form-control:focus { outline: none; border-color: var(--color-primary); }
    
    .status-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: left 12px center; background-size: 16px; padding-left: 40px; }
    
    .btn-submit { display: flex; justify-content: center; align-items: center; gap: 10px; width: 100%; padding: 16px; background-color: var(--color-primary); color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; letter-spacing: 0.5px; }
    .btn-submit:hover:not(:disabled) { background-color: #2b57cc; }
    .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; }
    
    .alert { padding: 16px; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: center; }
    .alert-success { background-color: #E6F4EA; color: #137333; border: 1px solid #CEEAD6; }
    .alert-danger { background-color: #FCE8E6; color: #C5221F; border: 1px solid #FAD2CF; }
    
    .loading-state, .empty-state { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; color: var(--color-text-secondary); text-align: center; }
    .empty-state .icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
    
    .mt-4 { margin-top: 1.5rem; }
    .mt-3 { margin-top: 1rem; }
  `]
})
export class FeedbackPanel implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private studentService = inject(StudentService);
  private testerService = inject(TesterService);

  moduleId: string = '';
  module: ModuleOverview | null = null;
  currentLesson: LessonDto | null = null;
  
  conditions: LookupDto[] = [];
  selectedConditionId: string = '';
  notes: string = '';
  
  isLoading = true;
  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.moduleId = params['moduleId'];
      if (this.moduleId) {
        this.loadModule();
      } else {
        this.router.navigate(['/tester']);
      }
    });

    this.loadConditions();
  }

  loadModule() {
    this.isLoading = true;
    this.studentService.getModuleUnits(this.moduleId).subscribe({
      next: (unitsData) => {
        const unitsWithLessonsPromises = unitsData.map(async (unit) => {
          const lessonsData = await this.studentService.getUnitLessons(unit.id).toPromise();
          return {
            ...unit,
            lessons: lessonsData || []
          };
        });
        
        Promise.all(unitsWithLessonsPromises).then(units => {
          this.module = {
            id: this.moduleId,
            name: 'تقييم الموديول',
            description: '',
            units: units
          };
          this.isLoading = false;

          // Auto-select first uncompleted lesson
          if (this.module && this.module.units) {
            for (const unit of this.module.units) {
              const uncompleted = unit.lessons.find(l => !l.isCompleted);
              if (uncompleted) {
                this.selectLesson(uncompleted);
                return;
              }
            }
            // If all completed, select first lesson
            if (this.module.units.length > 0 && this.module.units[0].lessons.length > 0) {
              this.selectLesson(this.module.units[0].lessons[0]);
            }
          }
        });
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'فشل في تحميل بيانات الموديول.';
      }
    });
  }

  loadConditions() {
    this.testerService.getConditions().subscribe({
      next: (data) => this.conditions = data,
      error: (err) => console.error('Failed to load conditions', err)
    });
  }

  selectLesson(lesson: LessonDto) {
    this.currentLesson = lesson;
    this.selectedConditionId = '';
    this.notes = '';
    this.successMessage = '';
    this.errorMessage = '';
  }

  submitFeedback() {
    if (!this.currentLesson || !this.selectedConditionId || !this.notes) return;
    
    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    
    const request = {
      lessonId: this.currentLesson.id,
      conditionOptionId: this.selectedConditionId, 
      notes: this.notes
    };

    // Parallel execution for saving feedback and marking lesson as complete
    Promise.all([
      this.testerService.submitFeedback(request).toPromise(),
      this.studentService.completeLesson(this.currentLesson.id, true).toPromise().catch(e => console.warn('Progress already updated or failed', e))
    ]).then(() => {
      this.isSubmitting = false;
      this.successMessage = 'تم تسجيل التقييم وتحديث نسبة التقدم بنجاح!';
      
      if (this.currentLesson) {
        this.currentLesson.isCompleted = true;
      }

      this.notes = '';
      this.selectedConditionId = '';
      setTimeout(() => this.successMessage = '', 4000);
    }).catch(err => {
      this.isSubmitting = false;
      this.errorMessage = err.error?.detail || 'فشل في إرسال التقييم. تأكد من وجود إصدار نشط.';
    });
  }

  goBack() {
    this.router.navigate(['/tester/dashboard']);
  }
}
