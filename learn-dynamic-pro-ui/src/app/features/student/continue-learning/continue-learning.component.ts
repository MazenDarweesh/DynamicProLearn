import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StudentService, LessonDetailDto } from '../../../core/services/student.service';
import { Dialog } from '../../../core/utils/dialog';
import { LessonSidebarComponent } from '../../../shared/components/lesson-sidebar/lesson-sidebar.component';

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
  
  levels: any[] = [];
  isLoading = true;
  activeLesson: LessonDetailDto | null = null;
  isLoadingLesson = false;
  isSubmitting = false;
  safeVideoUrl: SafeResourceUrl | null = null;

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
    this.studentService.getLessonDetail(lessonId).subscribe({
      next: (detail: any) => {
        this.activeLesson = detail;
        this.isLoadingLesson = false;
        
        if (detail.videoUrl) {
          let url = detail.videoUrl;
          if (url.includes('youtube.com/watch?v=')) {
            url = url.replace('watch?v=', 'embed/');
          }
          this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        } else {
          this.safeVideoUrl = null;
        }
      },
      error: () => {
        this.isLoadingLesson = false;
        Dialog.alert('تعذر تحميل تفاصيل الدرس.', 'خطأ', 'error');
      }
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
