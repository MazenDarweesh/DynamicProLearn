import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ModuleDto {
  id: string;
  name: string;
  description: string;
}

export interface UnitDto {
  id: string;
  title: string;
  orderIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5115/api/student';

  getAssignedModules(): Observable<ModuleDto[]> {
    return this.http.get<ModuleDto[]>(`${this.apiUrl}/modules`);
  }

  getModuleUnits(moduleId: string): Observable<UnitDto[]> {
    return this.http.get<UnitDto[]>(`${this.apiUrl}/modules/${moduleId}/units`);
  }
}
