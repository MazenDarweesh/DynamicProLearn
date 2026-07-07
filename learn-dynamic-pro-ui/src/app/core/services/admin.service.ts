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

  assignModule(moduleId: string, departmentId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/assignments`, { 
      moduleId, 
      departmentId, 
      isMandatory: true,
      dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString() // Due in 1 month
    });
  }
}
