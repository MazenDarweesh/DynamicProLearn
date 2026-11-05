import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ErpVersionDto, FeedbackRequest, LookupDto } from '../../models/tester.models';

export type * from '../../models/tester.models';

@Injectable({
  providedIn: 'root'
})
export class TesterService {
  private http = inject(HttpClient);
  private apiUrl = '/api/tester';

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
