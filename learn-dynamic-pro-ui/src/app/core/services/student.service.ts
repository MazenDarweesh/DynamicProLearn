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

export interface LessonDto {
  id: string;
  unitId: string;
  title: string;
  levelLabel: string;
  typeLabel: string;
  orderIndex: number;
  levelOrderIndex: number;
  levelSortOrder: number;
  isCompleted: boolean;
  pdfUrl?: string;
  externalLink?: string;
  erpKey?: string;
}

export interface LessonDetailDto extends LessonDto {
  videoUrl: string;
  pdfUrl?: string;
  externalLink?: string;
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

  getProgress(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/progress`);
  }

  getModuleUnits(moduleId: string): Observable<UnitDto[]> {
    return this.http.get<UnitDto[]>(`${this.apiUrl}/modules/${moduleId}/units`);
  }

  getUnitLessons(unitId: string): Observable<LessonDto[]> {
    return this.http.get<LessonDto[]>(`${this.apiUrl}/units/${unitId}/lessons`);
  }

  getLessonDetail(lessonId: string): Observable<LessonDetailDto> {
    return this.http.get<LessonDetailDto>(`${this.apiUrl}/lessons/${lessonId}`);
  }

  completeLesson(lessonId: string, isCompleted: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons/${lessonId}/complete`, isCompleted);
  }

  getLastLesson(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/last-lesson`);
  }

  getLessonsByLevel(moduleId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/modules/${moduleId}/levels`);
  }

  getUnifiedCurriculum(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/unified-curriculum`);
  }

  getNextLesson(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/next-lesson`);
  }
}
