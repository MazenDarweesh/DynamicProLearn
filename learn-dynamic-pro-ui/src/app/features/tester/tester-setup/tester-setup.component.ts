import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Dialog } from '../../../core/utils/dialog';

@Component({
  selector: 'app-tester-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tester-setup.component.html',
  styleUrl: './tester-setup.component.css'
})
export class TesterSetupComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = 'http://localhost:5115/api';

  versions: any[] = [];
  selectedVersionId: string = '';
  branchName: string = '';
  isSubmitting = false;

  ngOnInit() {
    this.http.get<any[]>(`${this.apiUrl}/Tester/versions`).subscribe({
      next: (data) => {
        this.versions = data;
        if (data.length > 0) {
          this.selectedVersionId = data[0].id;
        }
      },
      error: (err) => console.error('Error fetching versions', err)
    });
  }

  startTestingSession() {
    if (!this.selectedVersionId || !this.branchName.trim()) {
      Dialog.alert('الرجاء اختيار إصدار النظام وإدخال اسم الفرع/مرجع البناء.', 'بيانات مفقودة', 'info');
      return;
    }

    this.isSubmitting = true;
    this.http.post(`${this.apiUrl}/Tester/active-version`, {
      erpVersionId: this.selectedVersionId,
      branchName: this.branchName.trim()
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/tester/dashboard']);
      },
      error: (err) => {
        this.isSubmitting = false;
        Dialog.alert('حدث خطأ أثناء حفظ بيانات الجلسة.', 'خطأ', 'error');
        console.error(err);
      }
    });
  }
}
