import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'student',
    canActivate: [roleGuard(['Student', 'Admin'])],
    loadComponent: () => import('./features/student/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'tester',
    canActivate: [roleGuard(['Tester', 'Admin'])],
    loadComponent: () => import('./features/tester/feedback-panel/feedback-panel.component').then(m => m.FeedbackPanelComponent)
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
