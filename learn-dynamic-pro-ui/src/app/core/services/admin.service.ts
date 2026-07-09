import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminModuleDto {
  id: string;
  name: string;
  description: string;
  isPublished: boolean;
  totalUnits: number;
}

export interface CompanyDto {
  id: string;
  name: string;
  industry: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5115/api/admin';

  getModules(): Observable<AdminModuleDto[]> {
    return this.http.get<AdminModuleDto[]>(`${this.apiUrl}/modules`);
  }

  createModule(name: string, description: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/modules`, { name, description });
  }

  createUnit(moduleId: string, name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/units`, { moduleId, name, orderIndex: 1 });
  }

  createLesson(unitId: string, title: string): Observable<any> {
    // using dummy GUIDs for Level and Type for UI testing
    return this.http.post(`${this.apiUrl}/lessons`, { 
      unitId, 
      title, 
      videoUrl: 'https://video.url', 
      levelId: '00000000-0000-0000-0000-000000000001', 
      typeId: '00000000-0000-0000-0000-000000000001', 
      orderIndex: 1 
    });
  }

  getCompanies(): Observable<CompanyDto[]> {
    return this.http.get<CompanyDto[]>(`${this.apiUrl}/companies`);
  }

  createCompany(name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/companies`, { name });
  }

  getDepartments(companyId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/companies/${companyId}/departments`);
  }

  createDepartment(companyId: string, name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/departments`, { companyId, name });
  }

  getUsers(departmentId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/departments/${departmentId}/users`);
  }

  createUser(companyId: string, departmentId: string, username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, { companyId, departmentId, username, password, role: 1 });
  }

  getUnits(moduleId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/modules/${moduleId}/units`);
  }

  getLessons(unitId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/units/${unitId}/lessons`);
  }

  assignModule(moduleId: string, departmentId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/assignments`, { 
      moduleId, 
      departmentId, 
      isMandatory: true,
      dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });
  }

  getDepartmentAssignments(departmentId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/departments/${departmentId}/assignments`);
  }

  removeAssignment(assignmentId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/assignments/${assignmentId}`);
  }

  updateModule(id: string, name: string, description: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/modules/${id}`, { name, description });
  }

  updateUnit(id: string, name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/units/${id}`, { name, orderIndex: 1 });
  }

  updateLesson(id: string, title: string): Observable<any> {
    // using dummy GUIDs for Level and Type for UI testing
    return this.http.post(`${this.apiUrl}/lessons/${id}`, { 
      title, 
      videoUrl: 'https://video.url', 
      levelId: '00000000-0000-0000-0000-000000000001', 
      typeId: '00000000-0000-0000-0000-000000000001', 
      orderIndex: 1 
    });
  }

  deleteModule(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/modules/${id}`);
  }

  deleteUnit(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/units/${id}`);
  }

  deleteLesson(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/lessons/${id}`);
  }

  // --- New Endpoints ---
  updateCompany(id: string, name: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/companies/${id}`, { name });
  }

  deleteCompany(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/companies/${id}`);
  }

  updateDepartment(id: string, name: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/departments/${id}`, { name });
  }

  deleteDepartment(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/departments/${id}`);
  }

  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }

  getUsersProgress(departmentId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/departments/${departmentId}/users-progress`);
  }
}
