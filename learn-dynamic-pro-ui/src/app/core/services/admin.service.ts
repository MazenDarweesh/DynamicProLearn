import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AdminModuleDto {
  id: string;
  name: string;
  description: string;
  isPublished: boolean;
  totalUnits: number;
  assignedDepartments?: string[];
}

export interface LookupDto {
  id: string;
  label: string;
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

  // ── Modules ──────────────────────────────────────────────────────────────
  getModules(page = 1, pageSize = 10): Observable<AdminModuleDto[]> {
    return this.http.get<any>(`${this.apiUrl}/modules?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createModule(name: string, description: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/modules`, { name, description });
  }

  updateModule(id: string, name: string, description: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/modules/${id}`, { name, description });
  }

  deleteModule(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/modules/${id}`);
  }

  // ── Units ─────────────────────────────────────────────────────────────────
  getUnits(moduleId: string, pageSize = 100): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/modules/${moduleId}/units?pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createUnit(moduleId: string, name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/units`, { moduleId, name, orderIndex: 1 });
  }

  updateUnit(id: string, name: string, orderIndex: number = 1): Observable<any> {
    return this.http.post(`${this.apiUrl}/units/${id}`, { name, orderIndex });
  }

  deleteUnit(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/units/${id}`);
  }

  // ── Lessons ───────────────────────────────────────────────────────────────
  getLessons(unitId: string, pageSize = 100): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/units/${unitId}/lessons?pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createLesson(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons`, payload);
  }

  updateLesson(id: string, payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons/${id}`, payload);
  }

  deleteLesson(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/lessons/${id}`);
  }

  // ── Lookups ───────────────────────────────────────────────────────────────
  getLevels(): Observable<LookupDto[]> {
    return this.http.get<LookupDto[]>(`${this.apiUrl}/lookups/levels`);
  }

  getTypes(): Observable<LookupDto[]> {
    return this.http.get<LookupDto[]>(`${this.apiUrl}/lookups/types`);
  }

  // ── Companies ─────────────────────────────────────────────────────────────
  getCompanies(page = 1, pageSize = 10): Observable<CompanyDto[]> {
    return this.http.get<any>(`${this.apiUrl}/companies?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createCompany(name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/companies`, { name });
  }

  updateCompany(id: string, name: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/companies/${id}`, { name });
  }

  deleteCompany(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/companies/${id}`);
  }

  // ── Departments ───────────────────────────────────────────────────────────
  getDepartments(companyId: string, page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/companies/${companyId}/departments?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createDepartment(companyId: string, name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/departments`, { companyId, name });
  }

  updateDepartment(id: string, name: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/departments/${id}`, { name });
  }

  deleteDepartment(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/departments/${id}`);
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  getUsers(departmentId: string, page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/departments/${departmentId}/users?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createUser(companyId: string, departmentId: string, username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, { companyId, departmentId, username, password, role: 1 });
  }

  getUsersProgress(departmentId: string, page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/departments/${departmentId}/users-progress?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  assignModule(moduleId: string, departmentId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/assignments`, {
      moduleId,
      departmentId,
      isMandatory: true,
      dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });
  }

  getDepartmentAssignments(departmentId: string, page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/departments/${departmentId}/assignments?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  removeAssignment(assignmentId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/assignments/${assignmentId}`);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  getDashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }
}
