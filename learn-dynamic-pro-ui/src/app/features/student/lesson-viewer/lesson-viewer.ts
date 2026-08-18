import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StudentService, UnitDto, LessonDto, LessonDetailDto } from '../../../core/services/student.service';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { LessonSidebarComponent } from '../../../shared/components/lesson-sidebar/lesson-sidebar.component';

export interface UnitWithLessons extends UnitDto {
  lessons: LessonDto[];
}

@Component({
  selector: 'app-lesson-viewer',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent, LessonSidebarComponent],
  templateUrl: './lesson-viewer.html',
  styleUrl: './lesson-viewer.css'
})
export class LessonViewer implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private studentService = inject(StudentService);
  
  units: UnitWithLessons[] = [];
  isLoading = true;
  activeLesson: LessonDetailDto | null = null;
  isLoadingLesson = false;
  isSubmitting = false;
  safeVideoUrl: SafeResourceUrl | null = null;

  ngOnInit() {
    const moduleId = this.route.snapshot.paramMap.get('id');
    if (moduleId) {
      this.loadUnitsAndLessons(moduleId);
    }
  }

  async loadUnitsAndLessons(moduleId: string) {
    try {
      const unitsData = await this.studentService.getModuleUnits(moduleId).toPromise();
      if (unitsData) {
        const unitsWithLessonsPromises = unitsData.map(async (unit: any) => {
          const lessonsData = await this.studentService.getUnitLessons(unit.id).toPromise();
          return {
            ...unit,
            lessons: lessonsData || []
          };
        });
        
        this.units = await Promise.all(unitsWithLessonsPromises);
        
        // Auto-load specific lesson if provided in query params, else load first lesson
        const queryLessonId = this.route.snapshot.queryParamMap.get('lessonId');
        if (queryLessonId) {
          this.loadLesson(queryLessonId);
        } else if (this.units.length > 0 && this.units[0].lessons.length > 0) {
          this.loadLesson(this.units[0].lessons[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load module structure', err);
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
          // Extract YouTube video ID using Regex to handle complex URLs (playlists, timestamps)
          let url = detail.videoUrl;
          const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
          if (ytMatch && ytMatch[1]) {
            url = `https://www.youtube.com/embed/${ytMatch[1]}`;
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
        // Also update it in the units list sidebar
        const u = this.units.find(u => u.id === this.activeLesson?.unitId);
        if (u) {
          const l = u.lessons.find(l => l.id === this.activeLesson?.id);
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
    for (let u of this.units) {
      for (let lesson of u.lessons) {
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
