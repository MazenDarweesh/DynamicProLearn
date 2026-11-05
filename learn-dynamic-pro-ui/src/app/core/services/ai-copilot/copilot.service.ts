import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, shareReplay, BehaviorSubject, of, catchError } from 'rxjs';
import { AuthService } from '../platform-core/auth.service';
import { CopilotNetworkService } from './copilot-network.config';
import { CopilotSearchStreamService } from './copilot-search-stream.service';
import { CopilotAgentStreamService } from './copilot-agent-stream.service';
import {
  ErpBatchItem,
  NavRequest,
  NavResolution,
  LeftoverRequest,
  LeftoverResponse,
  ControlRolesRequest,
  ControlRolesResponse
} from '../../models/erp-form.models';

import {
  CopilotSource,
  CopilotFormFillData,
  CopilotFilterState,
  AgentStepItem,
  CopilotFeedbackRequest,
  AiReadinessResponse,
  CopilotFilterOption,
  CopilotFilterLesson,
  CopilotFilterUnit,
  CopilotFilterModule,
  StudentCopilotFilterData
} from '../../models/copilot.models';

export type * from '../../models/copilot.models';

@Injectable({
  providedIn: 'root'
})
export class CopilotService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private networkService = inject(CopilotNetworkService);
  private searchStreamService = inject(CopilotSearchStreamService);
  private agentStreamService = inject(CopilotAgentStreamService);

  private filterData$?: Observable<StudentCopilotFilterData>;

  setBaseUrls(aiUrl?: string, backendUrl?: string): void {
    this.networkService.setBaseUrls(aiUrl, backendUrl);
  }

  getAiBaseUrl(): string {
    return this.networkService.getAiBaseUrl();
  }

  sendErpTelemetry(batch: any): Promise<any> {
    const aiUrl = this.networkService.aiBaseUrl;
    return firstValueFrom(
      this.http.post(`${aiUrl}/v1/erp/telemetry`, batch).pipe(
        catchError((err) => {
          console.warn('[Copilot Telemetry] Failed to send telemetry batch:', err);
          return of({ status: 'failed' });
        })
      )
    );
  }

  private activeLessonIdSubject = new BehaviorSubject<string | undefined>(undefined);
  activeLessonId$ = this.activeLessonIdSubject.asObservable();

  setActiveLessonId(lessonId: string | undefined): void {
    this.activeLessonIdSubject.next(lessonId);
  }

  checkReadiness(): Observable<AiReadinessResponse> {
    const aiUrl = this.networkService.aiBaseUrl;
    return this.http.get<AiReadinessResponse>(`${aiUrl}/v1/ready`);
  }

  /**
   * Fetches the student's authorized modules, units, lessons, levels, and types tree.
   * Cached with shareReplay(1) so subsequent calls do not repeat the HTTP request.
   */
  getCopilotFilters(forceRefresh = false): Observable<StudentCopilotFilterData> {
    if (!this.filterData$ || forceRefresh) {
      this.filterData$ = undefined;
      const backendUrl = this.networkService.backendBaseUrl;
      const url = backendUrl ? `${backendUrl}/api/student/copilot-filters` : '/api/student/copilot-filters';
      this.filterData$ = this.http.get<StudentCopilotFilterData>(url, {
        headers: {
          'X-Skip-Auth-Redirect': 'true',
          'X-Copilot-Silent': 'true'
        }
      }).pipe(
        catchError(() => of({ modules: [], levels: [], types: [] })),
        shareReplay(1)
      );
    }
    return this.filterData$;
  }

  /**
   * Streams search query via Server-Sent Events (SSE).
   * Delegates to CopilotSearchStreamService.
   */
  streamSearch(
    query: string,
    lessonId?: string,
    onSources?: (sources: CopilotSource[]) => void,
    onToken?: (token: string) => void,
    onDone?: (meta?: any) => void,
    onError?: (err: any) => void,
    skipCache: boolean = false,
    filters?: CopilotFilterState,
    threadId?: string,
    visibleFields?: string[],
    erpKey?: string,
    onFormFill?: (fillData: CopilotFormFillData) => void,
    formSchema?: any[],
    erpIntent?: string
  ): Promise<void> {
    return this.searchStreamService.streamSearch(
      query,
      lessonId,
      onSources,
      onToken,
      onDone,
      onError,
      skipCache,
      filters,
      threadId,
      visibleFields,
      erpKey,
      onFormFill,
      formSchema,
      erpIntent
    );
  }

  sendFeedback(feedback: CopilotFeedbackRequest): Observable<any> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    const aiUrl = this.networkService.aiBaseUrl;
    console.info('%c[CoPilot Feedback] SENDING', 'color:#ec4899;font-weight:bold', feedback);
    return this.http.post(`${aiUrl}/v1/search/feedback`, feedback, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Admin-only: clears both Exact Cache and Semantic Cache in the Python AI engine.
   * Routes through the .NET proxy at /api/admin/ai/cache/clear (AdminOnly policy).
   */
  clearAiCache(): Observable<{ status: string; message: string }> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    console.info('%c[CoPilot Admin] CLEAR_CACHE', 'color:#f59e0b;font-weight:bold');
    const backendUrl = this.networkService.backendBaseUrl;
    const url = backendUrl ? `${backendUrl}/api/admin/ai/cache/clear` : '/api/admin/ai/cache/clear';
    return this.http.post<{ status: string; message: string }>(
      url,
      {},
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
  }

  /**
   * Resolves ERP autonomous navigation target using backend LLM + lexical reranking.
   * Calls POST /v1/erp/navigation/resolve via fetch for maximum transport reliability.
   */
  async resolveErpNavigation(req: NavRequest): Promise<NavResolution> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const aiUrl = this.networkService.aiBaseUrl;
    const res = await fetch(`${aiUrl}/v1/erp/navigation/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      throw new Error(`Navigation resolve failed with status ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Resolves dynamically revealed/dependent leftover fields during progressive form filling.
   * Calls POST /v1/erp/form-fill/resolve-leftover via fetch for maximum transport reliability.
   */
  async resolveErpLeftover(req: LeftoverRequest): Promise<LeftoverResponse> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const aiUrl = this.networkService.aiBaseUrl;
    const res = await fetch(`${aiUrl}/v1/erp/form-fill/resolve-leftover`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      throw new Error(`Leftover resolve failed with status ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Resolves functional button roles (add_row / new_form) via AI / backend cache.
   */
  async resolveErpControls(req: ControlRolesRequest): Promise<ControlRolesResponse> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const aiUrl = this.networkService.aiBaseUrl;
    const res = await fetch(`${aiUrl}/v1/erp/controls/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req)
    });
    if (!res.ok) {
      throw new Error(`Controls resolve failed with status ${res.status}`);
    }
    return await res.json();
  }

  /**
   * Sends applied / rejected feedback on an AI navigation decision to train the decision memory.
   */
  async feedbackErpNavigation(decisionId: string, outcome: 'applied' | 'rejected'): Promise<void> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const aiUrl = this.networkService.aiBaseUrl;
    try {
      await fetch(`${aiUrl}/v1/erp/navigation/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision_id: decisionId, outcome })
      });
    } catch (err) {
      console.warn('[Copilot Service] Feedback delivery failed silently:', err);
    }
  }

  /**
   * Stops any ongoing Vision Agent execution immediately via AbortController.
   */
  stopAgentExecution(): void {
    this.agentStreamService.stopAgentExecution();
  }

  /**
   * Executes autonomous vision-agent workflow by streaming SSE events from POST /v1/erp/agent/stream.
   * Delegates to CopilotAgentStreamService.
   */
  streamAgentExecution(
    goal: string,
    cdpPort: number = 9222,
    cdpHost: string = '127.0.0.1',
    maxSteps: number = 15,
    sessionId?: string,
    onStep?: (step: AgentStepItem) => void,
    onDone?: (lastStep?: AgentStepItem) => void,
    onError?: (err: any) => void
  ): Promise<void> {
    return this.agentStreamService.streamAgentExecution(
      goal,
      cdpPort,
      cdpHost,
      maxSteps,
      sessionId,
      onStep,
      onDone,
      onError
    );
  }
}
