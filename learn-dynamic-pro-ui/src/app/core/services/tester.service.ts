import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ErpVersionDto {
  id: string;
  versionNumber: string;
  releaseDate: string;
}

export interface FeedbackRequest {
  testerActiveVersionId: string;
  conditionOptionId: string;
  notes: string;
  severity: number;
}

@Injectable({
  providedIn: 'root'
})
export class TesterService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5115/api/tester';

  getVersions(): Observable<ErpVersionDto[]> {
    return this.http.get<ErpVersionDto[]>(`${this.apiUrl}/versions`);
  }

  submitFeedback(feedback: FeedbackRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/feedback`, feedback);
  }
}
