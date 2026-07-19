import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { TesterService } from '../../../core/services/tester.service';
import { Router } from '@angular/router';

export interface DashboardModule {
  id: string;
  name: string;
  description: string;
}

import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';

@Component({
  selector: 'app-tester-dashboard',
  standalone: true,
  imports: [CommonModule, AdminHeaderComponent],
  templateUrl: './tester-dashboard.component.html',
  styleUrl: './tester-dashboard.component.css'
})
export class TesterDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private testerService = inject(TesterService);
  private router = inject(Router);

  modules: DashboardModule[] = [];
  isLoading = true;

  ngOnInit() {
    this.testerService.getMyModules().subscribe({
      next: (data) => {
        this.modules = data || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load dashboard data', err);
        this.modules = [];
        this.isLoading = false;
      }
    });
  }

  openLesson(moduleId: string) {
    this.router.navigate(['/tester/feedback'], { queryParams: { moduleId } });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
