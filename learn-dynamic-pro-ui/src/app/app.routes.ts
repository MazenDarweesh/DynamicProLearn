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
    redirectTo: 'tester/setup',
    pathMatch: 'full'
  },
  {
    path: 'tester/setup',
    canActivate: [roleGuard(['Tester', 'Admin'])],
    loadComponent: () => import('./features/tester/tester-setup/tester-setup.component').then(m => m.TesterSetupComponent)
  },
  {
    path: 'tester/dashboard',
    canActivate: [roleGuard(['Tester', 'Admin'])],
    loadComponent: () => import('./features/tester/tester-dashboard/tester-dashboard.component').then(m => m.TesterDashboardComponent)
  },
  {
    path: 'tester/feedback',
    canActivate: [roleGuard(['Tester', 'Admin'])],
    loadComponent: () => import('./features/tester/feedback-panel/feedback-panel').then(m => m.FeedbackPanel)
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'admin/companies',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/users-manager/users-manager.component').then(m => m.UsersManagerComponent)
  },
  {
    path: 'admin/departments/:id',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/department-details/department-details.component').then(m => m.DepartmentDetailsComponent)
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
