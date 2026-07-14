import { Component, Input, inject } from '@angular/core';
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
export class LessonEditorComponent {
  @Input() lesson: any;
  @Input() lookups!: { levels: LookupDto[], types: LookupDto[] };

  private adminService = inject(AdminService);
  
  selectedPdfFile: File | null = null;
  isUploadingPdf = false;

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
