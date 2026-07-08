import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private adminService = inject(AdminService);

  companies: any[] = [];
  modules: any[] = [];
  stats = { companies: 0, users: 0, modules: 0, progress: '0%' };
  
  // Progress Table tracking
  selectedCompanyId: string = '';
  selectedDepartmentId: string = '';
  departments: any[] = [];
  progressUsers: any[] = [];

  ngOnInit() {
    this.loadStats();
    this.loadCompanies();
    this.loadModules();
  }

  loadStats() {
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats.companies = stats.totalCompanies;
        this.stats.users = stats.activeUsers;
        this.stats.modules = stats.publishedModules;
        this.stats.progress = `${stats.averageProgress}%`;
      }
    });
  }

  loadCompanies() {
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        if (data.length > 0 && !this.selectedCompanyId) {
          this.selectedCompanyId = data[0].id;
          this.onCompanyChange();
        }
        // Load departments for each company to show badges
        this.companies.forEach(c => {
          this.adminService.getDepartments(c.id).subscribe(depts => {
            c.departments = depts;
            // No need to manually count users anymore, stats handled it, but we can do it for display
            let totalUsers = 0;
            depts.forEach(d => {
              this.adminService.getUsers(d.id).subscribe(users => {
                totalUsers += users.length;
                c.totalUsers = totalUsers;
              });
            });
          });
        });
      }
    });
  }

  loadModules() {
    this.adminService.getModules().subscribe({
      next: (data) => {
        this.modules = data;
        // Load units and lessons
        this.modules.forEach(m => {
          this.adminService.getUnits(m.id).subscribe(units => {
            m.units = units;
            units.forEach((u: any) => {
              this.adminService.getLessons(u.id).subscribe(lessons => {
                u.lessons = lessons;
              });
            });
          });
        });
      }
    });
  }

  onCompanyChange() {
    if (!this.selectedCompanyId) return;
    this.adminService.getDepartments(this.selectedCompanyId).subscribe(depts => {
      this.departments = depts;
      if (depts.length > 0) {
        this.selectedDepartmentId = depts[0].id;
        this.onDepartmentChange();
      } else {
        this.progressUsers = [];
      }
    });
  }

  onDepartmentChange() {
    if (!this.selectedDepartmentId) return;
    this.adminService.getUsersProgress(this.selectedDepartmentId).subscribe(usersProgress => {
      this.progressUsers = usersProgress.map(u => ({
        name: u.userName,
        role: u.role,
        assignedModules: u.assignedModules,
        completed: `${u.completedLessons} / ${u.totalLessons}`,
        progressValue: u.progressPercentage
      }));
    });
  }

  editCompany(comp: any) {
    const newName = prompt('تعديل اسم الشركة:', comp.name);
    if (!newName) return;
    this.adminService.updateCompany(comp.id, newName).subscribe(() => comp.name = newName);
  }

  deleteCompany(comp: any) {
    if (confirm('هل أنت متأكد من حذف الشركة بجميع محتوياتها؟')) {
      this.adminService.deleteCompany(comp.id).subscribe(() => this.loadCompanies());
    }
  }

  editModule(mod: any) {
    const newName = prompt('تعديل اسم الموديول:', mod.name);
    if (!newName) return;
    this.adminService.updateModule(mod.id, newName, mod.description || '').subscribe(() => mod.name = newName);
  }

  deleteModule(mod: any) {
    if (confirm('هل أنت متأكد من حذف الموديول؟')) {
      this.adminService.deleteModule(mod.id).subscribe(() => this.loadModules());
    }
  }

  editUnit(unit: any) {
    const newName = prompt('تعديل اسم الوحدة:', unit.name);
    if (!newName) return;
    this.adminService.updateUnit(unit.id, newName).subscribe(() => unit.name = newName);
  }

  deleteUnit(unit: any) {
    if (confirm('هل أنت متأكد من حذف الوحدة؟')) {
      this.adminService.deleteUnit(unit.id).subscribe(() => this.loadModules());
    }
  }

  editLesson(lesson: any) {
    const newName = prompt('تعديل اسم الدرس:', lesson.title);
    if (!newName) return;
    this.adminService.updateLesson(lesson.id, newName).subscribe(() => lesson.title = newName);
  }

  deleteLesson(lesson: any) {
    if (confirm('هل أنت متأكد من حذف الدرس؟')) {
      this.adminService.deleteLesson(lesson.id).subscribe(() => this.loadModules());
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  goTo(path: string) {
    this.router.navigate([`/${path}`]);
  }

  notImplemented(feature: string) {
    alert(`[الربط قادم قريباً] جارِ تطوير الـ Backend الخاص بـ '${feature}'. الرجاء مراجعة قائمة المهام.`);
  }
}
