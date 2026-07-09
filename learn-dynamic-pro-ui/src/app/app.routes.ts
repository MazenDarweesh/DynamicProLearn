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
    path: 'student/lesson/:id',
    canActivate: [roleGuard(['Student', 'Admin'])],
    loadComponent: () => import('./features/student/lesson-viewer/lesson-viewer').then(m => m.LessonViewer)
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
    path: 'admin/users',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/users-manager/users-manager.component').then(m => m.UsersManagerComponent)
  },
  {
    path: 'admin/content',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/content-builder/content-builder.component').then(m => m.ContentBuilderComponent)
  },
  {
    path: 'admin/assignments',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/assignments-manager/assignments-manager.component').then(m => m.AssignmentsManagerComponent)
  },
  {
    path: 'admin/testers',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/admin-testers/admin-testers.component').then(m => m.AdminTestersComponent)
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
