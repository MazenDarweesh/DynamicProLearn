import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/platform-core/auth.service';
import { AdminService } from '../../../core/services/platform-core/admin.service';
import { Router } from '@angular/router';
import { Dialog } from '../../../core/utils/dialog';
import { AdminHeaderComponent } from '../../../shared/components/admin-header/admin-header.component';
import { AdminActionIconComponent } from '../../../shared/components/admin-action-icon/admin-action-icon.component';

import { AssignModulesModalComponent } from '../../../shared/components/assign-modules-modal/assign-modules-modal.component';
import { AdminModalComponent } from '../../../shared/components/admin-modal/admin-modal.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminHeaderComponent, AdminActionIconComponent, AssignModulesModalComponent, AdminModalComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private adminService = inject(AdminService);

  companies: any[] = [];
  modules: any[] = [];
  stats = { companies: 0, users: 0, testers: 0, modules: 0, progress: '0%' };
  
  showAllCompanies = false;
  showAllModules = false;
  showAllUsers = false;
  isSubmitting = false;
  
  // Progress Table tracking
  selectedCompanyId: string = '';
  selectedDepartmentId: string = '';
  departments: any[] = [];
  progressUsers: any[] = [];

  // Assign Modules state
  pendingAssignedModuleIds = new Set<string>();

  // Add/Edit User Modal State
  showUserModal = false;
  isUserEditMode = false;
  userFormData: any = {};
  filteredDepartmentsForUserForm: any[] = [];

  // Add Company Modal State
  showAddCompanyModal = false;
  editingCompanyId: string | null = null;
  originalDepartments: any[] = [];
  newCompanyName = '';
  newCompanyStatus = 'active';
  newDepartmentName = '';
  newDepartmentsList: { id?: string, name: string }[] = [];

  // Testers Panel State
  testersProgress: any[] = [];
  showAllTesters = false;
  showAddTesterModal = false;
  newTesterUsername = '';
  newTesterPassword = '';
  testerCompanyId = '';
  testerDepartmentId = '';
  testerDepartments: any[] = [];

  // Lookups for assignments
  allLevels: any[] = [];
  allTypes: any[] = [];



  ngOnInit() {
    this.refreshAllData();
  }

  refreshAllData() {
    this.loadStats();
    this.loadCompanies();
    this.loadModules();
    this.loadTestersProgress();
    this.loadLookups();
    if (this.selectedDepartmentId) {
      this.onDepartmentChange();
    }
  }

  loadLookups() {
    if (this.allLevels.length === 0) {
      this.adminService.getLevels().subscribe(res => this.allLevels = res);
    }
    if (this.allTypes.length === 0) {
      this.adminService.getTypes().subscribe(res => this.allTypes = res);
    }
  }

  trackById(_index: number, item: any): any {
    return item?.id ?? item?.userId ?? _index;
  }

  loadStats() {
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats = {
          companies: stats.totalCompanies,
          users: stats.activeUsers,
          testers: stats.activeTesters,
          modules: stats.publishedModules,
          progress: stats.averageProgress + '%'
        };
      },
      error: (err) => console.error('Error fetching stats', err)
    });
  }

  loadCompanies() {
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        this.companies = data;
        if (data.length > 0 && !this.selectedCompanyId) {
          this.selectedCompanyId = data[0].id;
        }
        // Load departments for each company to show badges (and reuse for selectedCompanyId without duplicate HTTP call)
        this.companies.forEach(c => {
          this.adminService.getDepartments(c.id).subscribe(depts => {
            c.departments = depts;
            if (c.id === this.selectedCompanyId) {
              this.departments = depts;
              if (depts.length > 0 && !this.selectedDepartmentId) {
                this.selectedDepartmentId = depts[0].id;
                this.onDepartmentChange();
              } else if (depts.length === 0) {
                this.progressUsers = [];
              }
            }
            let totalUsers = 0;
            depts.forEach((d: any) => {
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
    const cachedCompany = this.companies.find(c => c.id === this.selectedCompanyId);
    if (cachedCompany && Array.isArray(cachedCompany.departments)) {
      this.departments = cachedCompany.departments;
      if (this.departments.length > 0) {
        this.selectedDepartmentId = this.departments[0].id;
        this.onDepartmentChange();
      } else {
        this.progressUsers = [];
      }
      return;
    }
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
        userId: u.userId,
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

  async deleteCompany(comp: any) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف الشركة بجميع محتوياتها؟', 'تأكيد الحذف');
    if (ok) {
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
        videoUrl: l.videoUrl || '',
        levelId: l.levelId || '',
        typeId: l.typeId || '',
        orderIndex: l.orderIndex || 1
      }))
    }));
    
    // Store original state for deletion comparison
    this.originalUnits = JSON.parse(JSON.stringify(this.newUnitsList));
    this.showAddModuleModal = true;
  }

  async deleteModule(mod: any) {
    const ok = await Dialog.confirm('هل أنت متأكد من حذف الموديول؟', 'تأكيد الحذف');
    if (ok) {
      this.adminService.deleteModule(mod.id).subscribe(() => this.refreshAllData());
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
    Dialog.alert(`[الربط قادم قريباً] جارِ تطوير الـ Backend الخاص بـ '${feature}'. الرجاء مراجعة قائمة المهام.`, 'تنبيه', 'info');
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
      Dialog.alert('الرجاء إدخال اسم الشركة', 'تنبيه', 'info');
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
      Dialog.alert('حدث خطأ أثناء حفظ الشركة.', 'خطأ', 'error');
    }
  }

  // --- Add Module Modal Logic ---
  showAddModuleModal = false;
  editingModuleId: string | null = null;
  originalUnits: any[] = [];
  newModuleName = '';
  newModuleDescription = '';
  newUnitsList: { id?: string, name: string, lessons: { id?: string, title: string, videoUrl: string, levelId: string, typeId: string, orderIndex: number, levelOrderIndex: number }[] }[] = [];

  openAddModuleModal() {
    this.editingModuleId = null;
    this.originalUnits = [];
    this.showAddModuleModal = true;
    this.newModuleName = '';
    this.newModuleDescription = '';
    this.newUnitsList = [
      { name: 'الوحدة الأولى', lessons: [{ title: '', videoUrl: '', levelId: '', typeId: '', orderIndex: 1, levelOrderIndex: 1 }] }
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
    const allLessons = this.newUnitsList.flatMap(u => u.lessons || []);
    const defaultLevelId = this.allLevels.length ? this.allLevels[0].id : '';
    const defaultTypeId = this.allTypes.length ? this.allTypes[0].id : '';
    const existingInLevel = allLessons.filter(l => l.levelId === defaultLevelId);
    const maxOrder = existingInLevel.reduce((max, l) => Math.max(max, l.levelOrderIndex || 0), 0);

    this.newUnitsList[unitIndex].lessons.push({ 
      title: '', 
      videoUrl: '', 
      levelId: defaultLevelId, 
      typeId: defaultTypeId, 
      orderIndex: this.newUnitsList[unitIndex].lessons.length + 1, 
      levelOrderIndex: maxOrder + 1 
    });
  }

  onModalLessonLevelChange(lesson: any, newLevelId: string) {
    lesson.levelId = newLevelId;
    const allLessons = this.newUnitsList.flatMap(u => u.lessons || []);
    const otherLessonsInLevel = allLessons.filter(l => l !== lesson && l.levelId === newLevelId);
    const maxOrder = otherLessonsInLevel.reduce((max, l) => Math.max(max, l.levelOrderIndex || 0), 0);
    lesson.levelOrderIndex = maxOrder + 1;
  }

  removeLessonFromUnit(unitIndex: number, lessonIndex: number) {
    this.newUnitsList[unitIndex].lessons.splice(lessonIndex, 1);
  }

  async saveModule() {
    if (this.isSubmitting) return;
    if (!this.newModuleName.trim()) {
      Dialog.alert('الرجاء إدخال اسم الموديول', 'تنبيه', 'info');
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
            const payload = {
              title: lesson.title.trim(),
              videoUrl: lesson.videoUrl.trim(),
              levelId: lesson.levelId || '00000000-0000-0000-0000-000000000001',
              typeId: lesson.typeId || '00000000-0000-0000-0000-000000000001',
              orderIndex: lesson.orderIndex || 1,
              levelOrderIndex: lesson.levelOrderIndex || 1
            };
            if (lesson.id) {
              return this.adminService.updateLesson(lesson.id, payload).toPromise();
            } else {
              return this.adminService.createLesson({ unitId: unitId!, ...payload }).toPromise();
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
          const lessonPromises = validLessons.map(lesson => {
            const payload = {
              title: lesson.title.trim(),
              videoUrl: lesson.videoUrl.trim(),
              levelId: lesson.levelId || '00000000-0000-0000-0000-000000000001',
              typeId: lesson.typeId || '00000000-0000-0000-0000-000000000001',
              orderIndex: lesson.orderIndex || 1,
              levelOrderIndex: lesson.levelOrderIndex || 1
            };
            return this.adminService.createLesson({ unitId: newUnit.id, ...payload }).toPromise();
          });
          
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

  // --- User Editing Logic ---
  openAddUserModal() {
    this.isUserEditMode = false;
    this.userFormData = {
      username: '',
      password: '',
      companyId: this.selectedCompanyId || null,
      departmentId: this.selectedDepartmentId || null
    };

    if (this.userFormData.companyId) {
      this.adminService.getDepartments(this.userFormData.companyId, 1, 100).subscribe(res => {
        this.filteredDepartmentsForUserForm = res;
      });
    } else {
      this.filteredDepartmentsForUserForm = [];
    }

    this.showUserModal = true;
  }

  openEditUserModal(u: any) {
    this.isUserEditMode = true;
    this.userFormData = {
      userId: u.userId,
      username: u.name,
      password: '',
      // Since u is filtered by current selected company/dept, we can use them
      companyId: this.selectedCompanyId,
      departmentId: this.selectedDepartmentId
    };
    
    if (this.selectedCompanyId) {
      this.adminService.getDepartments(this.selectedCompanyId, 1, 100).subscribe(res => {
        this.filteredDepartmentsForUserForm = res;
        this.showUserModal = true;
      });
    } else {
      this.showUserModal = true;
    }
  }

  onUserFormCompanyChange() {
    this.userFormData.departmentId = null;
    if (this.userFormData.companyId) {
      this.adminService.getDepartments(this.userFormData.companyId, 1, 100).subscribe(res => {
        this.filteredDepartmentsForUserForm = res;
      });
    } else {
      this.filteredDepartmentsForUserForm = [];
    }
  }

  closeUserModal() {
    this.showUserModal = false;
  }

  saveUser() {
    if (!this.userFormData.username || !this.userFormData.companyId || !this.userFormData.departmentId) {
      Dialog.alert('يرجى ملء جميع الحقول المطلوبة', 'خطأ', 'error');
      return;
    }
    
    this.isSubmitting = true;

    if (this.isUserEditMode) {
      const payload = {
        username: this.userFormData.username,
        password: this.userFormData.password,
        companyId: this.userFormData.companyId,
        departmentId: this.userFormData.departmentId
      };

      this.adminService.updateUser(this.userFormData.userId, payload).subscribe({
        next: () => {
          this.isSubmitting = false;
          Dialog.alert('تم تعديل بيانات المستخدم بنجاح', 'نجاح', 'success');
          this.closeUserModal();
          this.onDepartmentChange();
        },
        error: () => {
          this.isSubmitting = false;
          Dialog.alert('حدث خطأ أثناء حفظ التعديلات', 'خطأ', 'error');
        }
      });
    } else {
      if (!this.userFormData.password) {
        this.isSubmitting = false;
        Dialog.alert('كلمة المرور مطلوبة', 'خطأ', 'error');
        return;
      }
      this.adminService.createUser(this.userFormData.companyId, this.userFormData.departmentId, this.userFormData.username, this.userFormData.password).subscribe({
        next: () => {
          this.isSubmitting = false;
          Dialog.alert('تمت إضافة المستخدم بنجاح', 'نجاح', 'success');
          this.closeUserModal();
          this.onDepartmentChange();
        },
        error: (err) => {
          this.isSubmitting = false;
          Dialog.alert(err?.error?.message || 'حدث خطأ', 'خطأ', 'error');
        }
      });
    }
  }

  deleteUser(userId: string) {
    if(!userId) {
      Dialog.alert('معرف المستخدم غير متوفر.', 'خطأ', 'error');
      return;
    }
    Dialog.confirm('هل أنت متأكد من حذف هذا المستخدم؟', 'تأكيد الحذف').then(confirmed => {
      if (confirmed) {
        this.adminService.deleteUser(userId).subscribe({
          next: () => {
            Dialog.alert('تم حذف المستخدم بنجاح', 'نجاح', 'success');
            this.onDepartmentChange();
          },
          error: (err) => {
            Dialog.alert('حدث خطأ أثناء الحذف', 'خطأ', 'error');
          }
        });
      }
    });
  }

  // --- Assign Modules Logic ---
  showAssignModulesModal = false;
  assigningCompany: any = null;
  assigningDepartment: any = null;
  assignedModules: any[] = [];
  pendingAssignedLevelIds: { [moduleId: string]: Set<string> } = {};
  pendingAssignedTypeIds: { [moduleId: string]: Set<string> } = {};

  openAssignModulesModal(company: any, department: any) {
    this.assigningCompany = company;
    this.assigningDepartment = department;
    this.assignedModules = [];
    this.pendingAssignedModuleIds.clear();
    this.pendingAssignedLevelIds = {};
    this.pendingAssignedTypeIds = {};
    this.showAssignModulesModal = true;
    
    this.adminService.getDepartmentAssignments(department.id).subscribe({
      next: (assignments) => {
        this.assignedModules = assignments;
        assignments.forEach((a: any) => {
          this.pendingAssignedModuleIds.add(a.moduleId);
          this.pendingAssignedLevelIds[a.moduleId] = new Set(a.levelFilters?.map((f: any) => f.levelId) || []);
          this.pendingAssignedTypeIds[a.moduleId] = new Set(a.typeFilters?.map((f: any) => f.typeId) || []);
        });
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
    this.pendingAssignedModuleIds.clear();
    this.pendingAssignedLevelIds = {};
    this.pendingAssignedTypeIds = {};
  }

  isModuleAssigned(moduleId: string): boolean {
    return this.pendingAssignedModuleIds.has(moduleId);
  }

  toggleModuleAssignment(moduleId: string, event: any) {
    if (event.target.checked) {
      this.pendingAssignedModuleIds.add(moduleId);
      if (!this.pendingAssignedLevelIds[moduleId]) this.pendingAssignedLevelIds[moduleId] = new Set();
      if (!this.pendingAssignedTypeIds[moduleId]) this.pendingAssignedTypeIds[moduleId] = new Set();
    } else {
      this.pendingAssignedModuleIds.delete(moduleId);
      delete this.pendingAssignedLevelIds[moduleId];
      delete this.pendingAssignedTypeIds[moduleId];
    }
  }

  isFilterSelected(moduleId: string, filterType: 'level' | 'type', filterId: string): boolean {
    if (filterType === 'level') return this.pendingAssignedLevelIds[moduleId]?.has(filterId) || false;
    return this.pendingAssignedTypeIds[moduleId]?.has(filterId) || false;
  }

  toggleFilterSelection(moduleId: string, filterType: 'level' | 'type', filterId: string, event: any) {
    const targetSet = filterType === 'level' ? this.pendingAssignedLevelIds[moduleId] : this.pendingAssignedTypeIds[moduleId];
    if (!targetSet) return;
    if (event.target.checked) targetSet.add(filterId);
    else targetSet.delete(filterId);
  }

  async saveModuleAssignments() {
    this.isSubmitting = true;
    const currentAssignmentIds = new Set(this.assignedModules.map(a => a.moduleId));
    const departmentId = this.assigningDepartment.id;

    const toAdd = Array.from(this.pendingAssignedModuleIds).filter(id => !currentAssignmentIds.has(id));
    const toRemove = this.assignedModules.filter(a => !this.pendingAssignedModuleIds.has(a.moduleId));

    try {
      for (const moduleId of toAdd) {
        await new Promise<void>((resolve, reject) => {
          const levelIds = Array.from(this.pendingAssignedLevelIds[moduleId] || []);
          const typeIds = Array.from(this.pendingAssignedTypeIds[moduleId] || []);
          this.adminService.assignModule(moduleId, departmentId, levelIds, typeIds).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }

      for (const assignment of this.assignedModules) {
        if (this.pendingAssignedModuleIds.has(assignment.moduleId)) {
          // It's still assigned, check if filters changed. For simplicity, delete and re-assign if it exists.
          // Wait, to keep it simple and correct, we can remove the old assignment and recreate it with new filters,
          // OR we can just let backend handle it if we modify assignModule to overwrite (but backend might just add duplicates).
          // Let's remove and recreate it so the filters update correctly.
          await new Promise<void>((resolve, reject) => {
            this.adminService.removeAssignment(assignment.id).subscribe({
              next: () => resolve(),
              error: (err) => reject(err)
            });
          });
          const moduleId = assignment.moduleId;
          await new Promise<void>((resolve, reject) => {
            const levelIds = Array.from(this.pendingAssignedLevelIds[moduleId] || []);
            const typeIds = Array.from(this.pendingAssignedTypeIds[moduleId] || []);
            this.adminService.assignModule(moduleId, departmentId, levelIds, typeIds).subscribe({
              next: () => resolve(),
              error: (err) => reject(err)
            });
          });
        }
      }

      for (const assignment of toRemove) {
        // We already handled re-creating updated ones above.
        // Wait, if it was in toRemove, we should also delete it.
        // But above we deleted EVERY assigned module that was kept. 
        // Let's just delete the ones in toRemove too.
        await new Promise<void>((resolve, reject) => {
          this.adminService.removeAssignment(assignment.id).subscribe({
            next: () => resolve(),
            error: (err) => reject(err)
          });
        });
      }
      
      this.isSubmitting = false;
      Dialog.alert('تم حفظ إسنادات الموديولات بنجاح!', 'نجاح', 'success');
      this.closeAssignModulesModal();
      this.refreshAllData();
    } catch (err: any) {
      this.isSubmitting = false;
      console.error('Error saving assignments', err);
      Dialog.alert('حدث خطأ أثناء حفظ الإسنادات.', 'خطأ', 'error');
    }
  }

  // ── Testers Panel Methods ───────────────────────────────────────────────────
  loadTestersProgress() {
    this.adminService.getTestersProgress(1, 100).subscribe({
      next: (testers) => {
        this.testersProgress = testers.map((t: any) => ({
          name: t.userName,
          role: 'مختبر نظام',
          assignedModules: t.assignedModules,
          completed: t.completedLessons,
          totalLessons: t.totalLessons,
          progressValue: t.totalLessons ? Math.round((t.completedLessons / t.totalLessons) * 100) : 0
        }));
      },
      error: (err) => console.error('Error fetching testers', err)
    });
  }

  openAddTesterModal() {
    this.newTesterUsername = '';
    this.newTesterPassword = '';
    this.testerCompanyId = '';
    this.testerDepartmentId = '';
    this.testerDepartments = [];
    this.showAddTesterModal = true;
  }

  closeAddTesterModal() {
    this.showAddTesterModal = false;
  }

  onTesterCompanyChange() {
    const company = this.companies.find(c => c.id === this.testerCompanyId);
    this.testerDepartments = company ? company.departments : [];
    this.testerDepartmentId = '';
  }

  submitTester() {
    if (!this.newTesterUsername || !this.newTesterPassword || !this.testerCompanyId || !this.testerDepartmentId) {
      Dialog.alert('الرجاء إكمال جميع الحقول المطلوبة للمختبر.', 'حقول مفقودة', 'info');
      return;
    }

    this.isSubmitting = true;
    this.adminService.createUser(this.testerCompanyId, this.testerDepartmentId, this.newTesterUsername, this.newTesterPassword, 2).subscribe({
      next: () => {
        this.isSubmitting = false;
        Dialog.alert('تمت إضافة المختبر بنجاح!', 'نجاح', 'success');
        this.closeAddTesterModal();
        this.refreshAllData();
      },
      error: (err) => {
        this.isSubmitting = false;
        Dialog.alert('حدث خطأ أثناء الإضافة: ' + (err.error?.detail || err.message), 'خطأ', 'error');
      }
    });
  }
}
