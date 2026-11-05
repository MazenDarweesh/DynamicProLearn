import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AdminModuleDto, LookupDto, CompanyDto } from '../../models/admin.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = '/api/admin';

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

  getLessonDetail(lessonId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/lessons/${lessonId}`);
  }

  retryLessonAiIngest(lessonId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons/${lessonId}/retry-ai-ingest`, {});
  }

  // ── Files ─────────────────────────────────────────────────────────────────
  uploadFile(file: File): Observable<{fileUrl: string}> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{fileUrl: string}>(`${this.apiUrl}/files/upload`, formData);
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

  getDepartmentDetails(departmentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/departments/${departmentId}/details`);
  }

  markLessonCompleteForDepartment(departmentId: string, lessonId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/departments/${departmentId}/lessons/${lessonId}/mark-complete`, {});
  }

  unmarkLessonCompleteForDepartment(departmentId: string, lessonId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/departments/${departmentId}/lessons/${lessonId}/unmark-complete`, {});
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  getUsers(departmentId: string, page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/departments/${departmentId}/users?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  createUser(companyId: string | null, departmentId: string | null, username: string, password: string, role: number = 1): Observable<any> {
    return this.http.post(`${this.apiUrl}/users`, { companyId, departmentId, username, password, role });
  }

  getUsersProgress(departmentId: string, page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/departments/${departmentId}/users-progress?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  getAllUsersProgress(companyId?: string | null, departmentId?: string | null, page = 1, pageSize = 100): Observable<any> {
    let url = `${this.apiUrl}/users-progress?page=${page}&pageSize=${pageSize}`;
    if (companyId) url += `&companyId=${companyId}`;
    if (departmentId) url += `&departmentId=${departmentId}`;
    return this.http.get<any>(url);
  }

  updateUser(userId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}`, data);
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`);
  }

  getUserDetails(userId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/${userId}/details`);
  }

  getTesterDetails(testerId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/testers/${testerId}/details`);
  }

  markLessonCompleteForUser(userId: string, lessonId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/${userId}/lessons/${lessonId}/mark-complete`, {});
  }

  unmarkLessonCompleteForUser(userId: string, lessonId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/${userId}/lessons/${lessonId}/unmark-complete`, {});
  }

  getTestersProgress(page = 1, pageSize = 10): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/testers-progress?page=${page}&pageSize=${pageSize}`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  // ── Assignments ───────────────────────────────────────────────────────────
  assignModule(moduleId: string, departmentId: string, levelIds: string[] = [], typeIds: string[] = []): Observable<any> {
    return this.http.post(`${this.apiUrl}/assignments`, {
      moduleId,
      departmentId,
      levelIds,
      typeIds,
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

  // ── Versions & Testers (New Architecture) ─────────────────────────────────
  getVersionSummaries(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/versions/summary`).pipe(
      map(items => (items || []).map(v => ({
        id: v.versionId,
        versionLabel: v.versionLabel,
        testersCount: v.testersCount || 0,
        assignedModulesCount: v.totalModulesAssigned ?? v.assignedModulesCount ?? 0
      })))
    );
  }

  createVersion(versionLabel: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/versions`, { versionLabel });
  }

  updateVersion(versionId: string, versionLabel: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/versions/${versionId}`, { versionLabel });
  }

  deleteVersion(versionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/versions/${versionId}`);
  }

  getVersionProgress(versionId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/versions/${versionId}/progress`);
  }

  getTesters(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/testers-progress?page=1&pageSize=100`).pipe(
      map(res => res.items ? res.items : res)
    );
  }

  assignTesterToVersion(versionId: string, testerId: string, moduleIds: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/versions/${versionId}/testers/${testerId}`, { moduleIds });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  getCurriculumAnalytics(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/analytics/curriculum`);
  }

  getLessonAnalytics(lessonId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/analytics/lessons/${lessonId}`);
  }

  completeLessonForTarget(lessonId: string, targetType: string, targetId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/analytics/lessons/${lessonId}/complete/${targetType}/${targetId}`, {});
  }

  uncompleteLessonForTarget(lessonId: string, targetType: string, targetId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/analytics/lessons/${lessonId}/uncomplete/${targetType}/${targetId}`, {});
  }

  // ── AI Studio (Quiz & Summary) ───────────────────────────────────────────
  generateLessonQuiz(lessonId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons/${lessonId}/generate-quiz`, {});
  }

  getLessonQuiz(lessonId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/lessons/${lessonId}/quiz`);
  }

  generateLessonSummary(lessonId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons/${lessonId}/generate-summary`, {});
  }

  getLessonSummary(lessonId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/lessons/${lessonId}/summary`);
  }

  getLessonAiJobStatus(lessonId: string, jobId?: string): Observable<any> {
    const url = jobId 
      ? `${this.apiUrl}/lessons/${lessonId}/ai-job-status/${jobId}`
      : `${this.apiUrl}/lessons/${lessonId}/ai-job-status`;
    return this.http.get(url);
  }
}
