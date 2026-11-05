import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { 
  StudentService, 
  LessonDetailDto,
  StudentLessonQuizDto,
  StudentLessonSummaryDto,
  StudentQuizStateDto,
  QuestionEvaluationResultDto 
} from '../../../core/services/platform-core/student.service';
import { Dialog } from '../../../core/utils/dialog';
import { LessonSidebarComponent } from '../../../shared/components/lesson-sidebar/lesson-sidebar.component';
import { CopilotService } from '../../../core/services/ai-copilot/copilot.service';

@Component({
  selector: 'app-continue-learning',
  standalone: true,
  imports: [CommonModule, LessonSidebarComponent],
  templateUrl: './continue-learning.component.html',
  styleUrls: ['../lesson-viewer/lesson-viewer.css']
})
export class ContinueLearningComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private studentService = inject(StudentService);
  private copilotService = inject(CopilotService);
  
  levels: any[] = [];
  isLoading = true;
  activeLesson: LessonDetailDto | null = null;
  isLoadingLesson = false;
  isSubmitting = false;
  safeVideoUrl: SafeResourceUrl | null = null;

  // ── AI Smart Content State ───────────────────────────────────────────────
  activeAiTab: 'summary' | 'quiz' = 'summary';
  isLoadingAi = false;
  quizData: StudentLessonQuizDto | null = null;
  summaryData: StudentLessonSummaryDto | null = null;
  quizState: StudentQuizStateDto | null = null;

  selectedOptions: { [questionNumber: number]: string } = {};
  evaluations: { [questionNumber: number]: QuestionEvaluationResultDto } = {};
  checkingQuestions: { [questionNumber: number]: boolean } = {};

  correctCount = 0;
  totalAnswered = 0;
  scorePercentage = 0;
  quizCompleted = false;
  isResettingQuiz = false;
  hasResumedAttempt = false;

  // Summary copy state
  isCopyingSummary = false;
  copiedSummarySuccess = false;

  ngOnInit() {
    this.loadUnifiedCurriculum();
  }

  async loadUnifiedCurriculum() {
    try {
      this.levels = await this.studentService.getUnifiedCurriculum().toPromise() || [];
      
      const queryLessonId = this.route.snapshot.queryParamMap.get('lessonId');
      if (queryLessonId) {
        this.loadLesson(queryLessonId);
      } else {
        // Find next lesson
        try {
          const nextLesson = await this.studentService.getNextLesson().toPromise();
          if (nextLesson && nextLesson.lessonId) {
            this.loadLesson(nextLesson.lessonId);
          }
        } catch(e) {
          console.error("Could not fetch next lesson, loading first available if any.");
          if (this.levels.length > 0 && this.levels[0].lessons.length > 0) {
            this.loadLesson(this.levels[0].lessons[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load unified curriculum structure', err);
    } finally {
      this.isLoading = false;
    }
  }
  
  loadLesson(lessonId: string) {
    this.isLoadingLesson = true;
    this.copilotService.setActiveLessonId(lessonId);
    this.quizData = null;
    this.summaryData = null;
    this.quizState = null;
    this.selectedOptions = {};
    this.evaluations = {};
    this.checkingQuestions = {};
    this.correctCount = 0;
    this.totalAnswered = 0;
    this.scorePercentage = 0;
    this.quizCompleted = false;
    this.hasResumedAttempt = false;

    this.studentService.getLessonDetail(lessonId).subscribe({
      next: (detail: any) => {
        this.activeLesson = detail;
        this.isLoadingLesson = false;
        
        if (detail.videoUrl) {
          let url = detail.videoUrl.trim();
          const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
          if (ytMatch && ytMatch[1]) {
            url = `https://www.youtube.com/embed/${ytMatch[1]}`;
          } else {
            const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
            if (driveMatch && driveMatch[1]) {
              url = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
            }
          }
          this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        } else {
          this.safeVideoUrl = null;
        }

        // Fetch AI Quiz and Summary directly from SQL Server via .NET
        this.loadAiContent(lessonId);
      },
      error: () => {
        this.isLoadingLesson = false;
        Dialog.alert('تعذر تحميل تفاصيل الدرس.', 'خطأ', 'error');
      }
    });
  }

  loadAiContent(lessonId: string) {
    this.isLoadingAi = true;

    // 1. Fetch Summary
    this.studentService.getLessonSummary(lessonId).subscribe({
      next: (data) => this.summaryData = data,
      error: () => this.summaryData = null
    });

    // 2. Fetch Quiz & Quiz State for Cross-Device Resumption
    this.studentService.getLessonQuiz(lessonId).subscribe({
      next: (quiz) => {
        this.quizData = quiz;
        
        // Check student's persistent progress state from SQL Server
        this.studentService.getQuizState(lessonId).subscribe({
          next: (state) => {
            this.quizState = state;
            if (state && state.answeredQuestions && state.answeredQuestions.length > 0) {
              this.hasResumedAttempt = true;
              this.correctCount = state.correctCount;
              this.totalAnswered = state.answeredCount;
              this.scorePercentage = state.scorePercentage;
              this.quizCompleted = state.isCompleted;

              // Restore each answered question into evaluations and selectedOptions
              for (const ans of state.answeredQuestions) {
                this.evaluations[ans.questionNumber] = ans;
                this.selectedOptions[ans.questionNumber] = ans.selectedOptionId;
              }
            }
          },
          error: (err) => console.warn('Could not fetch quiz state', err)
        });
      },
      error: () => this.quizData = null,
      complete: () => this.isLoadingAi = false
    });
  }

  selectOptionAndCheck(questionNumber: number, optionId: string) {
    if (!this.activeLesson) return;
    // Locking mutex: prevent changing answer if already evaluated, checking, or completed
    if (this.evaluations[questionNumber] || this.checkingQuestions[questionNumber] || this.quizCompleted) {
      return;
    }

    this.selectedOptions[questionNumber] = optionId;
    this.checkingQuestions[questionNumber] = true;

    this.studentService.checkQuizAnswer(this.activeLesson.id, {
      questionNumber,
      selectedOptionId: optionId
    }).subscribe({
      next: (res) => {
        this.evaluations[questionNumber] = res;
        if (res.isCorrect) {
          this.correctCount++;
        }
        this.totalAnswered++;

        const total = this.quizData?.questions?.length || 1;
        this.scorePercentage = Math.round((this.correctCount * 100) / total);

        // Auto-finalize if all questions are answered
        if (this.totalAnswered >= total) {
          this.quizCompleted = true;
          this.studentService.submitQuiz(this.activeLesson!.id).subscribe();
        }
        this.checkingQuestions[questionNumber] = false;
      },
      error: (err) => {
        console.error('Failed to evaluate answer', err);
        delete this.selectedOptions[questionNumber];
        this.checkingQuestions[questionNumber] = false;
        Dialog.alert('حدث خطأ أثناء فحص الإجابة. يرجى المحاولة مرة أخرى.', 'خطأ', 'error');
      }
    });
  }

  resetQuiz() {
    if (!this.activeLesson) return;

    if (!confirm('هل أنت متأكد من رغبتك في إعادة بدء الاختبار من الصفر؟ ستتم إعادة تعيين نتيجتك.')) {
      return;
    }

    this.isResettingQuiz = true;
    this.studentService.resetQuiz(this.activeLesson.id).subscribe({
      next: () => {
        this.selectedOptions = {};
        this.evaluations = {};
        this.checkingQuestions = {};
        this.correctCount = 0;
        this.totalAnswered = 0;
        this.scorePercentage = 0;
        this.quizCompleted = false;
        this.hasResumedAttempt = false;
        this.isResettingQuiz = false;
        Dialog.alert('تمت إعادة تهيئة الاختبار بنجاح. حظاً موفقاً!', 'تمت الإعادة', 'success');
      },
      error: (err) => {
        console.error('Failed to reset quiz', err);
        this.isResettingQuiz = false;
        Dialog.alert('فشل في إعادة ضبط الاختبار. يرجى المحاولة لاحقاً.', 'خطأ', 'error');
      }
    });
  }

  copySummaryToClipboard() {
    if (!this.summaryData) return;

    let text = `📌 ملخص درس: ${this.activeLesson?.title || ''}\n\n`;
    text += `💡 نظرة عامة:\n${this.summaryData.overview}\n\n`;
    text += `🔹 المحاور الرئيسية والملخص:\n`;
    
    for (const topic of this.summaryData.topics) {
      text += `\n▪️ ${topic.topicName}\n`;
      if (topic.explanation) {
        text += `   الشرح: ${topic.explanation}\n`;
      }
      if (topic.keyPoints && topic.keyPoints.length > 0) {
        text += `   النقاط الجوهرية:\n`;
        for (const pt of topic.keyPoints) {
          text += `   - ${pt}\n`;
        }
      }
    }

    navigator.clipboard.writeText(text).then(() => {
      this.copiedSummarySuccess = true;
      setTimeout(() => this.copiedSummarySuccess = false, 3000);
    }).catch(err => {
      console.error('Failed to copy to clipboard', err);
      Dialog.alert('تعذر نسخ الملخص إلى الحافظة.', 'تنبيه', 'info');
    });
  }

  goBack() {
    this.router.navigate(['/student']);
  }

  toggleCompletion() {
    if (!this.activeLesson) return;
    
    this.isSubmitting = true;
    const newStatus = !this.activeLesson.isCompleted;

    this.studentService.completeLesson(this.activeLesson.id, newStatus).subscribe({
      next: () => {
        this.activeLesson!.isCompleted = newStatus;
        // Update in sidebar list
        for(let lvl of this.levels) {
          const l = lvl.lessons.find((les:any) => les.id === this.activeLesson?.id);
          if (l) l.isCompleted = newStatus;
        }
        this.isSubmitting = false;

        if (newStatus) {
          this.navigateToNextIncompleteLesson();
        }
      },
      error: (err: any) => {
        Dialog.alert('فشل في تحديث حالة الدرس.', 'خطأ', 'error');
        this.isSubmitting = false;
      }
    });
  }

  navigateToNextIncompleteLesson() {
    let foundCurrent = false;
    for (let lvl of this.levels) {
      for (let lesson of lvl.lessons) {
        if (lesson.id === this.activeLesson?.id) {
          foundCurrent = true;
          continue;
        }
        if (foundCurrent && !lesson.isCompleted) {
          this.loadLesson(lesson.id);
          return;
        }
      }
    }
    Dialog.alert('تهانينا! لقد أكملت جميع الدروس المتاحة لك.', 'نجاح', 'success');
  }
}
