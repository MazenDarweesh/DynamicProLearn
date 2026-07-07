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

export interface UserDto {
  id: string;
  username: string;
  role: string;
  companyName: string;
  departmentName: string;
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

  // A mock endpoint call - assuming this exists or we can mock the UI
  getUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${this.apiUrl}/users`); // if it exists
  }
}
