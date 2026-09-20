import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LookupDto } from '../../../../../core/models/admin.models';
import { AdminService } from '../../../../../core/services/admin.service';
import { Dialog } from '../../../../../core/utils/dialog';

@Component({
  selector: 'app-lesson-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lesson-editor.component.html',
  styleUrls: ['./lesson-editor.component.css']
})
export class LessonEditorComponent implements OnChanges, OnDestroy {
  @Input() lesson: any;
  @Input() lookups!: { levels: LookupDto[], types: LookupDto[] };

  private adminService = inject(AdminService);
  
  selectedPdfFile: File | null = null;
  isUploadingPdf = false;

  // ── AI Studio State ────────────────────────────────────────────────────────
  isGeneratingQuiz = false;
  isGeneratingSummary = false;
  isLoadingQuiz = false;
  isLoadingSummary = false;
  isRetryingIngest = false;
  quizData: any = null;
  summaryData: any = null;
  showQuizModal = false;
  showSummaryModal = false;
  private pollInterval: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['lesson'] && this.lesson?.id) {
      this.fetchExistingAiContent();
      this.checkAndStartPolling();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  isAiReady(): boolean {
    return this.lesson?.aiStatus === 'Completed';
  }

  isAiProcessing(): boolean {
    return this.lesson?.aiStatus === 'Processing' || this.lesson?.aiStatus === 'Queued';
  }

  isAiFailed(): boolean {
    return this.lesson?.aiStatus === 'Failed';
  }

  checkAndStartPolling(): void {
    this.stopPolling();
    if (this.isAiProcessing() && this.lesson?.id) {
      this.pollInterval = setInterval(() => {
        this.adminService.getLessonDetail(this.lesson.id).subscribe({
          next: (detail) => {
            if (!detail) return;
            this.lesson.aiStatus = detail.aiStatus;
            this.lesson.aiError = detail.aiError;
            this.lesson.aiChunksCount = detail.aiChunksCount;
            this.lesson.aiProcessedAt = detail.aiProcessedAt;

            if (detail.aiStatus === 'Completed') {
              this.stopPolling();
              this.fetchExistingAiContent();
            } else if (detail.aiStatus === 'Failed') {
              this.stopPolling();
            }
          },
          error: () => this.stopPolling()
        });
      }, 4000);
    }

    if (this.lesson?.id) {
      this.adminService.getLessonAiJobStatus(this.lesson.id).subscribe({
        next: (job) => {
          if (job && (job.status === 1 || job.status === 'Processing' || job.status === 0 || job.status === 'Pending')) {
            if (job.jobType === 'Quiz' && !this.isGeneratingQuiz) {
              this.isGeneratingQuiz = true;
              this.pollAiJobStatus(this.lesson.id, job.jobId, 'Quiz');
            } else if (job.jobType === 'Summary' && !this.isGeneratingSummary) {
              this.isGeneratingSummary = true;
              this.pollAiJobStatus(this.lesson.id, job.jobId, 'Summary');
            }
          }
        },
        error: () => {}
      });
    }
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  retryIngest(): void {
    if (!this.lesson?.id) return;
    this.isRetryingIngest = true;
    this.adminService.retryLessonAiIngest(this.lesson.id).subscribe({
      next: () => {
        this.isRetryingIngest = false;
        this.lesson.aiStatus = 'Queued';
        this.lesson.aiError = null;
        Dialog.alert('تمت جدولة إعادة معالجة الدرس بالذكاء الاصطناعي بنجاح.', 'نجاح', 'success');
        this.checkAndStartPolling();
      },
      error: (err) => {
        this.isRetryingIngest = false;
        const msg = typeof err?.error === 'string' ? err.error : (err?.error?.message || 'تعذر إعادة محاولة المعالجة.');
        Dialog.alert(msg, 'خطأ', 'error');
      }
    });
  }

  fetchExistingAiContent(): void {
    if (!this.lesson?.id) return;
    
    // Check Quiz
    this.adminService.getLessonQuiz(this.lesson.id).subscribe({
      next: (data) => this.quizData = data,
      error: () => this.quizData = null
    });

    // Check Summary
    this.adminService.getLessonSummary(this.lesson.id).subscribe({
      next: (data) => this.summaryData = data,
      error: () => this.summaryData = null
    });
  }

  generateQuiz(): void {
    this.startAiGeneration('Quiz');
  }

  generateSummary(): void {
    this.startAiGeneration('Summary');
  }

  private startAiGeneration(jobType: 'Quiz' | 'Summary'): void {
    if (!this.lesson?.id) return;
    const isQuiz = jobType === 'Quiz';
    if (isQuiz) this.isGeneratingQuiz = true; else this.isGeneratingSummary = true;

    const action$ = isQuiz 
      ? this.adminService.generateLessonQuiz(this.lesson.id)
      : this.adminService.generateLessonSummary(this.lesson.id);

    const label = isQuiz ? 'اختبار' : 'ملخص';

    action$.subscribe({
      next: (job) => {
        Dialog.toast(`بدأ توليد ${label} الدرس بالذكاء الاصطناعي في الخلفية...`, 'info');
        this.pollAiJobStatus(this.lesson.id, job?.jobId || job?.id, jobType);
      },
      error: (err) => {
        if (isQuiz) this.isGeneratingQuiz = false; else this.isGeneratingSummary = false;
        const msg = typeof err?.error === 'string' 
          ? err.error 
          : (err?.error?.message || err?.error?.detail || `عفواً، تعذر توليد ال${label}. تأكد من أن الدرس تمت معالجته في محرك الذكاء الاصطناعي.`);
        Dialog.alert(msg, 'تنبيه', 'error');
      }
    });
  }

  private pollAiJobStatus(lessonId: string, jobId: string | undefined, jobType: 'Quiz' | 'Summary'): void {
    const isQuiz = jobType === 'Quiz';
    const label = isQuiz ? 'اختبار' : 'ملخص';
    const setBusy = (val: boolean) => {
      if (isQuiz) this.isGeneratingQuiz = val; else this.isGeneratingSummary = val;
    };

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      this.adminService.getLessonAiJobStatus(lessonId, jobId).subscribe({
        next: (job) => {
          if (!job) return;
          const isCompleted = job.status === 2 || job.status === 'Completed';
          const isFailed = job.status === 3 || job.status === 'Failed';

          if (isCompleted) {
            clearInterval(interval);
            setBusy(false);
            Dialog.toast(`تم اكتمال توليد ${label} الدرس بالذكاء الاصطناعي بنجاح!`, 'success');
            if (isQuiz) {
              this.adminService.getLessonQuiz(lessonId).subscribe(data => this.quizData = data);
            } else {
              this.adminService.getLessonSummary(lessonId).subscribe(data => this.summaryData = data);
            }
          } else if (isFailed || attempts > 30) {
            clearInterval(interval);
            setBusy(false);
            const errorMsg = job.error || (attempts > 30 ? 'انتهت مهلة انتظار المعالجة في الخلفية.' : 'فشلت معالجة المهمة.');
            Dialog.toast(errorMsg, 'error');
          }
        },
        error: () => {
          if (attempts > 15) {
            clearInterval(interval);
            setBusy(false);
          }
        }
      });
    }, 2000);
  }

  openQuizModal(): void {
    if (!this.quizData && this.lesson?.id) {
      this.isLoadingQuiz = true;
      this.adminService.getLessonQuiz(this.lesson.id).subscribe({
        next: (data) => {
          this.quizData = data;
          this.isLoadingQuiz = false;
          this.showQuizModal = true;
        },
        error: () => {
          this.isLoadingQuiz = false;
          Dialog.alert('لم يتم العثور على اختبار لهذا الدرس بعد.', 'تنبيه', 'info');
        }
      });
    } else {
      this.showQuizModal = true;
    }
  }

  openSummaryModal(): void {
    if (!this.summaryData && this.lesson?.id) {
      this.isLoadingSummary = true;
      this.adminService.getLessonSummary(this.lesson.id).subscribe({
        next: (data) => {
          this.summaryData = data;
          this.isLoadingSummary = false;
          this.showSummaryModal = true;
        },
        error: () => {
          this.isLoadingSummary = false;
          Dialog.alert('لم يتم العثور على ملخص لهذا الدرس بعد.', 'تنبيه', 'info');
        }
      });
    } else {
      this.showSummaryModal = true;
    }
  }

  closeModals(): void {
    this.showQuizModal = false;
    this.showSummaryModal = false;
  }

  get pdfLinkInput(): string {
    return this.lesson?.pdfUrl?.includes('/uploads/') ? '' : (this.lesson?.pdfUrl || '');
  }
  set pdfLinkInput(val: string) {
    if (this.lesson) {
      this.lesson.pdfUrl = val;
    }
  }

  removeUploadedPdf() {
    if (this.lesson) {
      this.lesson.pdfUrl = null;
    }
    this.selectedPdfFile = null;
  }

  onPdfFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedPdfFile = file;
    } else {
      this.selectedPdfFile = null;
      Dialog.alert('يرجى اختيار ملف PDF صالح', 'ملف غير مدعوم', 'info');
    }
  }

  uploadPdf(): void {
    if (!this.selectedPdfFile) return;

    this.isUploadingPdf = true;
    this.adminService.uploadFile(this.selectedPdfFile).subscribe({
      next: (res: { fileUrl: string }) => {
        this.lesson.pdfUrl = res.fileUrl;
        this.isUploadingPdf = false;
        this.selectedPdfFile = null;
        Dialog.alert('تم رفع الملف بنجاح', 'نجاح', 'success');
      },
      error: (err) => {
        this.isUploadingPdf = false;
        Dialog.alert('حدث خطأ أثناء رفع الملف', 'خطأ', 'error');
      }
    });
  }
}
