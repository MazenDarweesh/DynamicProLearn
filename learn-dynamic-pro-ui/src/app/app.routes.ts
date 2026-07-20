import { Routes } from '@angular/router';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'erp-redirect',
    loadComponent: () => import('./features/auth/erp-redirect/erp-redirect.component').then(m => m.ErpRedirectComponent)
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
    path: 'admin/analytics',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/analytics/lessons-analytics/lessons-analytics.component').then(m => m.LessonsAnalyticsComponent)
  },
  {
    path: 'admin/analytics/lesson/:id',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/analytics/lesson-details-analytics/lesson-details-analytics.component').then(m => m.LessonDetailsAnalyticsComponent)
  },
  {
    path: 'admin/employees',
    canActivate: [roleGuard(['Admin'])],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/employees-manager/employees-manager.component').then(m => m.EmployeesManagerComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/admin/employee-details/employee-details.component').then(m => m.EmployeeDetailsComponent)
      }
    ]
  },
  {
    path: 'admin/testers',
    canActivate: [roleGuard(['Admin'])],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/admin-testers/admin-testers.component').then(m => m.AdminTestersComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/admin/tester-details/tester-details.component').then(m => m.TesterDetailsComponent)
      }
    ]
  },
  {
    path: 'admin/versions/:id',
    canActivate: [roleGuard(['Admin'])],
    loadComponent: () => import('./features/admin/admin-version-details/admin-version-details.component').then(m => m.AdminVersionDetailsComponent)
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
