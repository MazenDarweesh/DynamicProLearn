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
    <div class="console-container" dir="rtl">
      <!-- Header -->
      <header class="console-header">
        <div class="header-content">
          <div class="brand w-100 d-flex justify-between align-center">
            <h1>DynamicProLearn <span class="font-light">نافذة التقييم (QA)</span></h1>
            <div>
              <button class="btn-back" (click)="goBack()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 14l-4-4 4-4"></path>
                  <path d="M5 10h11a4 4 0 1 1 0 8h-1"></path>
                </svg>
                العودة للوحة المختبر
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="console-body">
        <!-- Sidebar -->
        <div class="viewer-sidebar">
          <div *ngIf="isLoading" class="loading">جاري تحميل الوحدات...</div>
          <div *ngIf="!isLoading && module?.units?.length === 0" class="empty-state">لا يوجد وحدات في هذا الموديول.</div>
          
          <div class="unit" *ngFor="let unit of module?.units; let i = index">
            <h4>{{ i + 1 }}. {{ unit.title }}</h4>
            
            <div *ngIf="unit.lessons && unit.lessons.length === 0" class="text-secondary text-sm" style="padding-right: 15px;">
              لا توجد دروس
            </div>

            <div class="lesson-item" 
                 *ngFor="let lesson of unit.lessons; let lIndex = index"
                 [class.active]="currentLesson?.id === lesson.id"
                 (click)="selectLesson(lesson)">
              
              <div style="display: flex; align-items: center; gap: 10px;">
                <svg *ngIf="lesson.typeLabel === 'Video'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                <svg *ngIf="lesson.typeLabel !== 'Video'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                
                <span>{{ i + 1 }}.{{ lIndex + 1 }} {{ lesson.title }}</span>
              </div>

              <div class="lesson-status" [class.completed]="lesson.isCompleted">
                <svg *ngIf="lesson.isCompleted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <div class="viewer-main">
          <div *ngIf="isLoading" class="video-placeholder text-white">
            جاري تحميل الدرس...
          </div>

          <div *ngIf="!isLoading && !currentLesson && module?.units?.length" class="video-placeholder text-white" style="background-color: var(--color-bg-card); color: var(--color-navy) !important; border: 1px solid var(--color-border);">
            يرجى اختيار درس من القائمة الجانبية
          </div>

          <div *ngIf="!isLoading && currentLesson">
            <div class="lesson-details" style="margin-top: 0; margin-bottom: 25px;">
              <div class="d-flex justify-between align-start">
                <div>
                  <div class="badge">{{ currentLesson.levelLabel }} - {{ currentLesson.typeLabel }}</div>
                  <h2>{{ currentLesson.title }}</h2>
                  <p class="text-secondary">يرجى فحص هذه الشاشة بعناية وتسجيل الملاحظات الهيكلية حولها لضمان خلوها من العيوب قبل إطلاقها للطلاب.</p>
                </div>
              </div>
            </div>

            <div class="lesson-details" style="margin-top: 0;">
              <div class="panel-heading" style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); color: var(--color-primary);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <h3 style="margin: 0; font-size: 20px; color: var(--color-navy);">لوحة التقييم والجودة (QA)</h3>
              </div>
              
              <form (ngSubmit)="submitFeedback()" class="feedback-form">
                <div class="form-group">
                  <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px; color: var(--color-navy);">حالة النظام / التقييم (System Status):</label>
                  <div class="custom-select-wrapper">
                    <select class="form-control status-select" [(ngModel)]="selectedConditionId" name="condition" required style="width: 100%; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 8px; background-color: var(--color-bg-main); color: var(--color-navy); font-family: inherit; font-size: 15px; transition: border-color 0.2s; appearance: none; background-image: url('data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: left 12px center; background-size: 16px; padding-left: 40px;">
                      <option value="" disabled selected>-- اختر حالة التقييم المرجعية --</option>
                      <option *ngFor="let cond of conditions" [value]="cond.id">
                        {{ cond.label }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="form-group" style="margin-top: 1.5rem;">
                  <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px; color: var(--color-navy);">📝 الملاحظات الهيكلية للمختبر (أسباب المشكلة أو التفاصيل):</label>
                  <textarea 
                    class="form-control" 
                    [(ngModel)]="notes" 
                    name="notes" 
                    rows="4" 
                    placeholder="اكتب ملاحظاتك التقنية أو خطوات إعادة إنتاج الخطأ هنا..." 
                    required style="width: 100%; padding: 14px 16px; border: 1px solid var(--color-border); border-radius: 8px; background-color: var(--color-bg-main); color: var(--color-navy); font-family: inherit; font-size: 15px; transition: border-color 0.2s;">
                  </textarea>
                </div>

                <div class="form-actions" style="margin-top: 1.5rem;">
                  <button type="submit" class="btn-accent w-100" style="justify-content: center; font-size: 16px; letter-spacing: 0.5px;" [disabled]="isSubmitting || !selectedConditionId || !notes">
                    <span *ngIf="isSubmitting" class="spinner-small"></span>
                    <span *ngIf="!isSubmitting">📤 اعتماد النتيجة وحفظها في قاعدة الإصدار</span>
                  </button>
                </div>

                <div *ngIf="successMessage" class="alert-success mt-3">{{ successMessage }}</div>
                <div *ngIf="errorMessage" class="alert-danger mt-3">{{ errorMessage }}</div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .console-container { 
      background-color: var(--color-bg-page); 
      min-height: 100vh; 
      padding-bottom: 50px; 
      font-family: 'Readex Pro', sans-serif; 
      text-align: right; 
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .console-header { 
      background-color: var(--color-primary); 
      color: white; 
      padding: 25px 0; 
    }

    .header-content { 
      max-width: 1400px; 
      margin: 0 auto; 
      padding: 0 30px; 
      display: flex; 
      align-items: center;
      justify-content: space-between;
    }

    .brand h1 { 
      margin: 0; 
      font-size: 24px; 
      font-weight: 600; 
      color: white; 
      display: flex; 
      align-items: center; 
      gap: 8px; 
    }
    .font-light { font-weight: 400; font-size: 16px; opacity: 0.9; margin-right: 5px; }

    .btn-back {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: white;
      padding: 6px 15px;
      border-radius: 6px;
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      transition: 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-back:hover { background: rgba(255,255,255,0.2); }

    /* Body */
    .console-body { 
      flex: 1;
      padding: 30px; 
      max-width: 1400px; 
      width: 100%;
      margin: 0 auto; 
      display: flex;
      gap: 30px;
    }

    /* Sidebar */
    .viewer-sidebar {
      width: 320px;
      background: white;
      border-radius: 12px;
      border: 1px solid var(--color-border);
      padding: 20px;
      height: calc(100vh - 150px);
      overflow-y: auto;
    }

    .unit {
      margin-bottom: 25px;
    }
    .unit h4 {
      font-size: 15px;
      color: var(--color-text-secondary);
      margin: 0 0 10px 0;
      font-weight: 600;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 8px;
    }

    .lesson-item {
      padding: 12px 15px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 5px;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: 0.2s;
      color: var(--color-navy);
    }
    .lesson-item:hover { background-color: var(--color-bg-page); }
    .lesson-item.active { 
      background-color: var(--color-primary-light); 
      color: var(--color-primary); 
      font-weight: 600; 
    }
    .lesson-status {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lesson-status.completed {
      border-color: #28a745;
      background: #28a745;
      color: white;
    }
    .lesson-status svg {
      width: 12px;
      height: 12px;
    }

    /* Main Area */
    .viewer-main { 
      flex: 1; 
      display: flex; 
      flex-direction: column; 
      overflow-y: auto; 
      height: calc(100vh - 150px);
    }

    .video-placeholder { 
      background-color: #111; 
      aspect-ratio: 16/9; 
      border-radius: 12px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }

    .lesson-details { 
      background: white;
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 30px; 
    }
    .badge { 
      background: var(--color-accent-light); 
      color: #B35E11; 
      padding: 4px 12px; 
      border-radius: 6px; 
      display: inline-block; 
      font-size: 13px; 
      font-weight: 600; 
      margin-bottom: 15px; 
    }
    .lesson-details h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
      color: var(--color-navy);
    }
    .text-secondary { color: var(--color-text-secondary); line-height: 1.6; }

    /* Buttons */
    .btn-accent { 
      background-color: var(--color-accent); 
      color: white; 
      border: none; 
      padding: 12px 24px; 
      border-radius: 6px; 
      font-family: inherit; 
      font-weight: 600; 
      font-size: 15px; 
      cursor: pointer; 
      transition: 0.2s; 
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-accent:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(254, 147, 46, 0.3); }
    .btn-accent:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

    .loading, .empty-state { padding: 40px; text-align: center; color: var(--color-text-secondary); font-size: 16px; background: var(--color-bg-page); border-radius: 8px; border: 1px dashed var(--color-border); }

    /* Utilities */
    .w-100 { width: 100%; }
    .d-flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .align-start { align-items: flex-start; }
    .align-center { align-items: center; }
    .text-white { color: white; }
    .text-center { text-align: center; }
    .text-sm { font-size: 13px; }

    .form-control:focus { outline: none; border-color: var(--color-primary); }

    .alert-success { background-color: #E6F4EA; color: #137333; border: 1px solid #CEEAD6; padding: 16px; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: center; }
    .alert-danger { background-color: #FCE8E6; color: #C5221F; border: 1px solid #FAD2CF; padding: 16px; border-radius: 8px; font-size: 14px; font-weight: 500; text-align: center; }
    
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
