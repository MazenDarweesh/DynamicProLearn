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
  
  showAllCompanies = false;
  showAllModules = false;
  showAllUsers = false;
  isSubmitting = false;
  
  // Progress Table tracking
  selectedCompanyId: string = '';
  selectedDepartmentId: string = '';
  departments: any[] = [];
  progressUsers: any[] = [];

  // Add Company Modal State
  showAddCompanyModal = false;
  editingCompanyId: string | null = null;
  originalDepartments: any[] = [];
  newCompanyName = '';
  newCompanyStatus = 'active';
  newDepartmentName = '';
  newDepartmentsList: { id?: string, name: string }[] = [];

  ngOnInit() {
    this.refreshAllData();
  }

  refreshAllData() {
    this.loadStats();
    this.loadCompanies();
    this.loadModules();
    if (this.selectedDepartmentId) {
      this.onDepartmentChange();
    }
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
    this.editingCompanyId = comp.id;
    this.newCompanyName = comp.name;
    
    // Deep clone departments for editing
    this.newDepartmentsList = (comp.departments || []).map((d: any) => ({
      id: d.id,
      name: d.name
    }));
    
    this.originalDepartments = JSON.parse(JSON.stringify(this.newDepartmentsList));
    this.showAddCompanyModal = true;
  }

  deleteCompany(comp: any) {
    if (confirm('هل أنت متأكد من حذف الشركة بجميع محتوياتها؟')) {
      this.adminService.deleteCompany(comp.id).subscribe(() => this.refreshAllData());
    }
  }

  editModule(mod: any) {
    this.editingModuleId = mod.id;
    this.newModuleName = mod.name;
    this.newModuleDescription = mod.description || '';
    
    // Deep clone units and lessons for editing
    this.newUnitsList = (mod.units || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      lessons: (u.lessons || []).map((l: any) => ({
        id: l.id,
        title: l.title,
        videoUrl: l.videoUrl || ''
      }))
    }));
    
    // Store original state for deletion comparison
    this.originalUnits = JSON.parse(JSON.stringify(this.newUnitsList));
    this.showAddModuleModal = true;
  }

  deleteModule(mod: any) {
    if (confirm('هل أنت متأكد من حذف الموديول؟')) {
      this.adminService.deleteModule(mod.id).subscribe(() => this.refreshAllData());
    }
  }

  editUnit(unit: any) {
    const newName = prompt('تعديل اسم الوحدة:', unit.name);
    if (!newName) return;
    this.adminService.updateUnit(unit.id, newName).subscribe(() => unit.name = newName);
  }

  deleteUnit(unit: any) {
    if (confirm('هل أنت متأكد من حذف الوحدة؟')) {
      this.adminService.deleteUnit(unit.id).subscribe(() => this.refreshAllData());
    }
  }

  editLesson(lesson: any) {
    const newName = prompt('تعديل اسم الدرس:', lesson.title);
    if (!newName) return;
    this.adminService.updateLesson(lesson.id, newName).subscribe(() => lesson.title = newName);
  }

  deleteLesson(lesson: any) {
    if (confirm('هل أنت متأكد من حذف الدرس؟')) {
      this.adminService.deleteLesson(lesson.id).subscribe(() => this.refreshAllData());
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
    this.editingCompanyId = null;
    this.originalDepartments = [];
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
      this.newDepartmentsList.push({ name: this.newDepartmentName.trim() });
      this.newDepartmentName = '';
    }
  }

  removeDepartmentFromList(index: number) {
    this.newDepartmentsList.splice(index, 1);
  }

  async saveCompany() {
    if (this.isSubmitting) return;
    if (!this.newCompanyName.trim()) {
      alert('الرجاء إدخال اسم الشركة');
      return;
    }
    
    this.isSubmitting = true;
    try {
      if (this.editingCompanyId) {
        // --- EDIT MODE ---
        await this.adminService.updateCompany(this.editingCompanyId, this.newCompanyName).toPromise();
        
        const currentDeptIds = this.newDepartmentsList.filter(d => d.id).map(d => d.id);
        const originalDeptIds = this.originalDepartments.map(d => d.id);
        
        // Find deleted departments
        const deptsToDelete = originalDeptIds.filter(id => !currentDeptIds.includes(id));
        if (deptsToDelete.length > 0) {
          await Promise.all(deptsToDelete.map(id => this.adminService.deleteDepartment(id).toPromise()));
        }
        
        // Save/Update valid departments
        const validDepts = this.newDepartmentsList.filter(d => d.name.trim());
        const deptPromises = validDepts.map(dept => {
          if (dept.id) {
            return this.adminService.updateDepartment(dept.id, dept.name.trim()).toPromise();
          } else {
            return this.adminService.createDepartment(this.editingCompanyId!, dept.name.trim()).toPromise();
          }
        });
        
        await Promise.all(deptPromises);
        
      } else {
        // --- CREATE MODE ---
        const comp = await this.adminService.createCompany(this.newCompanyName).toPromise();
        const companyId = comp.id;
        
        const validDepts = this.newDepartmentsList.filter(d => d.name.trim());
        const deptPromises = validDepts.map(dept => 
          this.adminService.createDepartment(companyId, dept.name.trim()).toPromise()
        );
        
        await Promise.all(deptPromises);
      }
      
      this.isSubmitting = false;
      this.closeAddCompanyModal();
      this.refreshAllData();
    } catch (err) {
      this.isSubmitting = false;
      console.error('Error saving company', err);
      alert('حدث خطأ أثناء حفظ الشركة.');
    }
  }

  // --- Add Module Modal Logic ---
  showAddModuleModal = false;
  editingModuleId: string | null = null;
  originalUnits: any[] = [];
  newModuleName = '';
  newModuleDescription = '';
  newUnitsList: { id?: string, name: string, lessons: { id?: string, title: string, videoUrl: string }[] }[] = [];

  openAddModuleModal() {
    this.editingModuleId = null;
    this.originalUnits = [];
    this.showAddModuleModal = true;
    this.newModuleName = '';
    this.newModuleDescription = '';
    this.newUnitsList = [
      { name: 'الوحدة الأولى', lessons: [{ title: '', videoUrl: '' }, { title: '', videoUrl: '' }] }
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
    this.newUnitsList[unitIndex].lessons.push({ title: '', videoUrl: '' });
  }

  removeLessonFromUnit(unitIndex: number, lessonIndex: number) {
    this.newUnitsList[unitIndex].lessons.splice(lessonIndex, 1);
  }

  async saveModule() {
    if (this.isSubmitting) return;
    if (!this.newModuleName.trim()) {
      alert('الرجاء إدخال اسم الموديول');
      return;
    }

    this.isSubmitting = true;
    try {
      const descriptionToSave = this.newModuleDescription.trim() || 'وصف تلقائي';
      if (this.editingModuleId) {
        // --- EDIT MODE ---
        await this.adminService.updateModule(this.editingModuleId, this.newModuleName, descriptionToSave).toPromise();
        
        // Find deleted units
        const currentUnitIds = this.newUnitsList.filter(u => u.id).map(u => u.id);
        const originalUnitIds = this.originalUnits.map(u => u.id);
        const unitsToDelete = originalUnitIds.filter(id => !currentUnitIds.includes(id));
        
        if (unitsToDelete.length > 0) {
          await Promise.all(unitsToDelete.map(id => this.adminService.deleteUnit(id).toPromise()));
        }
        
        // Find deleted lessons
        const currentLessonIds: string[] = [];
        this.newUnitsList.forEach(u => u.lessons.forEach(l => { if (l.id) currentLessonIds.push(l.id); }));
        
        const originalLessonIds: string[] = [];
        this.originalUnits.forEach(u => u.lessons.forEach((l: any) => { if (l.id) originalLessonIds.push(l.id); }));
        
        const lessonsToDelete = originalLessonIds.filter(id => !currentLessonIds.includes(id));
        if (lessonsToDelete.length > 0) {
          // We don't need to delete lessons whose parent unit was already deleted to avoid 404s
          const lessonsToExplicitlyDelete = lessonsToDelete.filter(lId => {
            const parentUnit = this.originalUnits.find(ou => ou.lessons.some((ol: any) => ol.id === lId));
            return parentUnit && !unitsToDelete.includes(parentUnit.id);
          });
          if (lessonsToExplicitlyDelete.length > 0) {
            await Promise.all(lessonsToExplicitlyDelete.map(id => this.adminService.deleteLesson(id).toPromise()));
          }
        }
        
        // Save/Update valid units
        const validUnits = this.newUnitsList.filter(u => u.name.trim());
        const unitPromises = validUnits.map(async unit => {
          let unitId = unit.id;
          if (unitId) {
            await this.adminService.updateUnit(unitId, unit.name.trim()).toPromise();
          } else {
            const newUnit = await this.adminService.createUnit(this.editingModuleId!, unit.name.trim()).toPromise();
            unitId = newUnit.id;
          }
          
          const validLessons = unit.lessons.filter(l => l.title.trim());
          const lessonPromises = validLessons.map(lesson => {
            if (lesson.id) {
              return this.adminService.updateLesson(lesson.id, lesson.title.trim(), lesson.videoUrl.trim()).toPromise();
            } else {
              return this.adminService.createLesson(unitId!, lesson.title.trim(), lesson.videoUrl.trim()).toPromise();
            }
          });
          
          return Promise.all(lessonPromises);
        });
        
        await Promise.all(unitPromises);

      } else {
        // --- CREATE MODE ---
        const mod = await this.adminService.createModule(this.newModuleName, descriptionToSave).toPromise();
        const moduleId = mod.id;

        // Smart parallel saving for Units and Lessons
        const validUnits = this.newUnitsList.filter(u => u.name.trim());
        const unitPromises = validUnits.map(async unit => {
          const newUnit = await this.adminService.createUnit(moduleId, unit.name.trim()).toPromise();
          
          const validLessons = unit.lessons.filter(l => l.title.trim());
          const lessonPromises = validLessons.map(lesson => 
            this.adminService.createLesson(newUnit.id, lesson.title.trim(), lesson.videoUrl.trim()).toPromise()
          );
          
          return Promise.all(lessonPromises);
        });

        await Promise.all(unitPromises);
      }

      this.isSubmitting = false;
      this.closeAddModuleModal();
      this.refreshAllData();
    } catch (err) {
      this.isSubmitting = false;
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
    if (this.isSubmitting) return;
    if (!this.newUser.username || !this.newUser.password || !this.newUser.companyId || !this.newUser.departmentId) {
      alert('الرجاء تعبئة جميع الحقول المطلوبة');
      return;
    }
    
    this.isSubmitting = true;
    this.adminService.createUser(this.newUser.companyId, this.newUser.departmentId, this.newUser.username, this.newUser.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.closeAddUserModal();
        this.refreshAllData();
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error creating user', err);
        alert('حدث خطأ أثناء إضافة المستخدم.');
      }
    });
  }

  // --- Assign Modules Logic ---
  showAssignModulesModal = false;
  assigningCompany: any = null;
  assigningDepartment: any = null;
  assignedModules: any[] = [];

  openAssignModulesModal(company: any, department: any) {
    this.assigningCompany = company;
    this.assigningDepartment = department;
    this.assignedModules = [];
    this.showAssignModulesModal = true;
    
    this.adminService.getDepartmentAssignments(department.id).subscribe({
      next: (assignments) => {
        this.assignedModules = assignments;
      },
      error: (err) => {
        console.error('Error fetching assignments', err);
      }
    });
  }

  closeAssignModulesModal() {
    this.showAssignModulesModal = false;
    this.assigningCompany = null;
    this.assigningDepartment = null;
  }

  isModuleAssigned(moduleId: string): boolean {
    return this.assignedModules.some(a => a.moduleId === moduleId);
  }

  toggleModuleAssignment(moduleId: string, event: any) {
    const isChecked = event.target.checked;
    if (isChecked) {
      this.adminService.assignModule(moduleId, this.assigningDepartment.id).subscribe({
        next: (assignment) => {
          this.assignedModules.push(assignment);
          this.refreshAllData();
        },
        error: (err) => {
          console.error('Error assigning module', err);
          event.target.checked = false;
          alert('حدث خطأ أثناء الإسناد.');
        }
      });
    } else {
      const assignment = this.assignedModules.find(a => a.moduleId === moduleId);
      if (assignment) {
        this.adminService.removeAssignment(assignment.id).subscribe({
          next: () => {
            this.assignedModules = this.assignedModules.filter(a => a.id !== assignment.id);
            this.refreshAllData();
          },
          error: (err) => {
            console.error('Error removing assignment', err);
            event.target.checked = true;
            alert('حدث خطأ أثناء إزالة الإسناد.');
          }
        });
      }
    }
  }
}
