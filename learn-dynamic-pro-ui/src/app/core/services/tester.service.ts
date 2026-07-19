import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ErpVersionDto {
  id: string;
  versionLabel: string;
}

export interface FeedbackRequest {
  lessonId: string;
  conditionOptionId: string;
  notes: string;
}

export interface LookupDto {
  id: string;
  label: string;
}

@Injectable({
  providedIn: 'root'
})
export class TesterService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5115/api/tester';

  getVersions(): Observable<ErpVersionDto[]> {
    return this.http.get<ErpVersionDto[]>(`${this.apiUrl}/my-versions`);
  }

  getMyModules(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/my-modules`);
  }

  getConditions(): Observable<LookupDto[]> {
    return this.http.get<LookupDto[]>(`${this.apiUrl}/conditions`);
  }

  submitFeedback(feedback: FeedbackRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/feedback`, feedback);
  }
}
