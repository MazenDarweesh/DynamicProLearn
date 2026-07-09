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

  // Add Company Modal State
  showAddCompanyModal = false;
  newCompanyName = '';
  newCompanyStatus = 'active';
  newDepartmentName = '';
  newDepartmentsList: string[] = [];

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

  // --- Modal Logic ---
  openAddCompanyModal() {
    this.showAddCompanyModal = true;
    this.newCompanyName = '';
    this.newCompanyStatus = 'active';
    this.newDepartmentName = '';
    this.newDepartmentsList = [];
  }

  closeAddCompanyModal() {
    this.showAddCompanyModal = false;
  }

  addDepartmentToList() {
    if (this.newDepartmentName.trim()) {
      this.newDepartmentsList.push(this.newDepartmentName.trim());
      this.newDepartmentName = '';
    }
  }

  removeDepartmentFromList(index: number) {
    this.newDepartmentsList.splice(index, 1);
  }

  saveCompany() {
    if (!this.newCompanyName.trim()) {
      alert('الرجاء إدخال اسم الشركة');
      return;
    }
    this.adminService.createCompany(this.newCompanyName).subscribe({
      next: (comp) => {
        const companyId = comp.id;
        if (this.newDepartmentsList.length > 0) {
          let completed = 0;
          this.newDepartmentsList.forEach(deptName => {
            this.adminService.createDepartment(companyId, deptName).subscribe(() => {
              completed++;
              if (completed === this.newDepartmentsList.length) {
                this.closeAddCompanyModal();
                this.loadCompanies();
                this.loadStats();
              }
            });
          });
        } else {
          this.closeAddCompanyModal();
          this.loadCompanies();
          this.loadStats();
        }
      },
      error: (err) => {
        console.error('Error creating company', err);
        alert('حدث خطأ أثناء إنشاء الشركة.');
      }
    });
  }

  // --- Add Module Modal Logic ---
  showAddModuleModal = false;
  newModuleName = '';
  newModuleDescription = '';
  newUnitsList: { name: string, lessons: { title: string }[] }[] = [];

  openAddModuleModal() {
    this.showAddModuleModal = true;
    this.newModuleName = '';
    this.newModuleDescription = '';
    this.newUnitsList = [
      { name: 'الوحدة الأولى', lessons: [{ title: '' }, { title: '' }] }
    ];
  }

  closeAddModuleModal() {
    this.showAddModuleModal = false;
  }

  addUnit() {
    this.newUnitsList.push({ name: '', lessons: [] });
  }

  removeUnit(unitIndex: number) {
    this.newUnitsList.splice(unitIndex, 1);
  }

  addLessonToUnit(unitIndex: number) {
    this.newUnitsList[unitIndex].lessons.push({ title: '' });
  }

  removeLessonFromUnit(unitIndex: number, lessonIndex: number) {
    this.newUnitsList[unitIndex].lessons.splice(lessonIndex, 1);
  }

  async saveModule() {
    if (!this.newModuleName.trim()) {
      alert('الرجاء إدخال اسم الموديول');
      return;
    }

    try {
      const descriptionToSave = this.newModuleDescription.trim() || 'وصف تلقائي';
      const mod = await this.adminService.createModule(this.newModuleName, descriptionToSave).toPromise();
      const moduleId = mod.id;

      for (const unit of this.newUnitsList) {
        if (unit.name.trim()) {
          const newUnit = await this.adminService.createUnit(moduleId, unit.name.trim()).toPromise();
          const unitId = newUnit.id;

          for (const lesson of unit.lessons) {
            if (lesson.title.trim()) {
              await this.adminService.createLesson(unitId, lesson.title.trim()).toPromise();
            }
          }
        }
      }

      this.closeAddModuleModal();
      this.loadModules();
      this.loadStats();
    } catch (err) {
      console.error('Error creating module', err);
      alert('حدث خطأ أثناء إنشاء الموديول.');
    }
  }

  // --- Add User Modal Logic ---
  showAddUserModal = false;
  newUser = { username: '', password: '', companyId: '', departmentId: '' };
  newUserDepartments: any[] = [];

  openAddUserModal() {
    this.showAddUserModal = true;
    this.newUser = { 
      username: '', 
      password: '', 
      companyId: this.selectedCompanyId || '', 
      departmentId: this.selectedDepartmentId || '' 
    };
    
    if (this.newUser.companyId) {
      this.onUserCompanyChange();
    } else {
      this.newUserDepartments = [];
    }
  }

  closeAddUserModal() {
    this.showAddUserModal = false;
  }

  onUserCompanyChange() {
    if (!this.newUser.companyId) return;
    this.adminService.getDepartments(this.newUser.companyId).subscribe(depts => {
      this.newUserDepartments = depts;
      // If the currently selected department is not in the new list, clear it
      if (!depts.find(d => d.id === this.newUser.departmentId)) {
        this.newUser.departmentId = '';
      }
    });
  }

  saveUser() {
    if (!this.newUser.username || !this.newUser.password || !this.newUser.companyId || !this.newUser.departmentId) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }
    
    this.notImplemented('إضافة مستخدم');
    this.closeAddUserModal();
  }
}
