import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'student',
    canActivate: [roleGuard(['Student', 'Admin'])],
    loadComponent: () => import('./features/student/dashboard/dashboard').then(m => m.DashboardComponent)
  },
  {
    path: 'tester',
    canActivate: [roleGuard(['Tester', 'Admin'])],
    loadComponent: () => import('./features/tester/feedback-panel/feedback-panel').then(m => m.FeedbackPanel)
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent)
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
