import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { StudentService, ModuleDto } from '../../../core/services/student.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private studentService = inject(StudentService);
  private router = inject(Router);

  modules: ModuleDto[] = [];
  isLoading = true;

  ngOnInit() {
    this.studentService.getAssignedModules().subscribe({
      next: (data) => {
        this.modules = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load modules', err);
        // Mock data fallback just for demo
        this.modules = [
          { id: 'm1', name: 'مقدمة عن نظام DynamicPro', description: 'تعلم الأساسيات الخاصة بنظام إدارة المؤسسات الخاص بنا.' },
          { id: 'm2', name: 'المحاسبة المالية', description: 'إتقان موديولات الحسابات العامة والمدفوعات والمقبوضات.' }
        ];
        this.isLoading = false;
      }
    });
  }

  openLesson(moduleId: string) {
    this.router.navigate(['/student/lesson', moduleId]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
