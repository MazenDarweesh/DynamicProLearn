import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, shareReplay, BehaviorSubject, of, catchError } from 'rxjs';
import { AuthService } from './auth.service';
import {
  ErpBatchItem,
  NavRequest,
  NavResolution,
  LeftoverRequest,
  LeftoverResponse,
  ControlRolesRequest,
  ControlRolesResponse
} from '../models/erp-form.models';

export interface CopilotSource {
  type?: 'video' | 'pdf' | string;
  url?: string;
  start?: number;
  end?: number;
  page?: number | null;
  section?: string | null;
  lesson_id?: string;
  // legacy/optional display helpers returned from some endpoints
  title?: string;
  lesson_title?: string;
  timestamp?: string;
  video_url?: string;
  relevance_score?: number;
}

export interface CopilotFeedbackRequest {
  query: string;
  answer: string;
  rating: 'UP' | 'DOWN' | 'up' | 'down' | string;
  comment?: string;
  lesson_id?: string;
  thread_id?: string;
  sources?: any[];
}

export interface AiReadinessResponse {
  status: string;
  ready: boolean;
  startup_duration_seconds?: number;
  gemini_model?: string;
  environment?: string;
}

export interface AgentStepItem {
  step: number;
  status: 'connecting' | 'connected' | 'observing' | 'acting' | 'completed' | 'error';
  message: string;
  thought?: string;
  action?: string;
  coordinate?: [number, number];
  text?: string;
}

export interface CopilotFormFillData {
  intent?: string;
  fields?: Record<string, any>;
  rows?: Record<string, any>[];
  screenKey?: string;
  pageId?: number | string;
  documentName?: string;
  batch_mode?: boolean;
  batch_items?: ErpBatchItem[];
}

export interface CopilotFilterOption {
  id: string;
  name: string;
  sortOrder: number;
}

export interface CopilotFilterLesson {
  id: string;
  title: string;
  levelId: string;
  typeId: string;
  erpKey?: string;
}

export interface CopilotFilterUnit {
  id: string;
  title: string;
  lessons: CopilotFilterLesson[];
}

export interface CopilotFilterModule {
  id: string;
  title: string;
  code: string;
  units: CopilotFilterUnit[];
}

export interface StudentCopilotFilterData {
  modules: CopilotFilterModule[];
  levels: CopilotFilterOption[];
  types: CopilotFilterOption[];
}

export interface CopilotFilterState {
  scope: 'all' | 'module' | 'unit' | 'lesson' | 'lessons';
  moduleId?: string;
  unitId?: string;
  lessonId?: string;
  lessonIds?: string[];
  levelId?: string;
  typeId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CopilotService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private normalizeTunnelUrl(url: string): string {
    let clean = url.trim().replace(/[<>]/g, '').replace(/\/+$/, '');
    if (clean.includes('.devtunnels.ms')) {
      clean = clean.replace(/^http:\/\//i, 'https://').replace(/:80(?=\/|$)/, '');
      if (!clean.startsWith('http')) {
        clean = 'https://' + clean;
      }
    }
    return clean;
  }

  private detectDefaultAiUrl(): string {
    if (typeof window !== 'undefined') {
      const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
      const tunnelScript = scripts.find(s => s.src && s.src.includes('.devtunnels.ms'));
      if (tunnelScript) {
        try {
          const parsed = new URL(tunnelScript.src);
          return `https://${parsed.host.replace(/-(?:4200|5115)\./, '-8000.')}`;
        } catch {}
      }
      if (window.location.host.includes('.devtunnels.ms')) {
        return `https://${window.location.host.replace(/-(?:4200|5115)\./, '-8000.')}`;
      }
    }
    return 'http://localhost:8000';
  }

  private detectDefaultBackendUrl(): string {
    if (typeof window !== 'undefined') {
      const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
      const tunnelScript = scripts.find(s => s.src && s.src.includes('.devtunnels.ms'));
      if (tunnelScript) {
        try {
          const parsed = new URL(tunnelScript.src);
          const backendUrl = `https://${parsed.host.replace(/-(?:4200|8000)\./, '-5115.')}`;
          this.authService.setBackendUrl(backendUrl);
          return backendUrl;
        } catch {}
      }
      if (window.location.host.includes('.devtunnels.ms')) {
        const backendUrl = `https://${window.location.host.replace(/-(?:4200|8000)\./, '-5115.')}`;
        this.authService.setBackendUrl(backendUrl);
        return backendUrl;
      }
    }
    return '';
  }

  private aiBaseUrl = this.detectDefaultAiUrl();
  private backendBaseUrl = this.detectDefaultBackendUrl();
  private filterData$?: Observable<StudentCopilotFilterData>;

  setBaseUrls(aiUrl?: string, backendUrl?: string) {
    if (aiUrl) {
      const cleanAi = this.normalizeTunnelUrl(aiUrl);
      if (cleanAi) {
        this.aiBaseUrl = cleanAi;
      }
    }
    if (backendUrl) {
      const cleanBackend = this.normalizeTunnelUrl(backendUrl);
      if (cleanBackend) {
        this.backendBaseUrl = cleanBackend;
        this.authService.setBackendUrl(cleanBackend);
      }
    }
  }

  getAiBaseUrl(): string {
    return this.aiBaseUrl;
  }

  sendErpTelemetry(batch: any): Promise<any> {
    return firstValueFrom(
      this.http.post(`${this.aiBaseUrl}/v1/erp/telemetry`, batch).pipe(
        catchError((err) => {
          console.warn('[Copilot Telemetry] Failed to send telemetry batch:', err);
          return of({ status: 'failed' });
        })
      )
    );
  }

  private activeLessonIdSubject = new BehaviorSubject<string | undefined>(undefined);
  activeLessonId$ = this.activeLessonIdSubject.asObservable();

  setActiveLessonId(lessonId: string | undefined) {
    this.activeLessonIdSubject.next(lessonId);
  }

  checkReadiness(): Observable<AiReadinessResponse> {
    return this.http.get<AiReadinessResponse>(`${this.aiBaseUrl}/v1/ready`);
  }

  /**
   * Fetches the student's authorized modules, units, lessons, levels, and types tree.
   * Cached with shareReplay(1) so subsequent calls do not repeat the HTTP request.
   */
  getCopilotFilters(forceRefresh = false): Observable<StudentCopilotFilterData> {
    if (!this.filterData$ || forceRefresh) {
      this.filterData$ = undefined;
      const url = this.backendBaseUrl ? `${this.backendBaseUrl}/api/student/copilot-filters` : '/api/student/copilot-filters';
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

  async streamSearch(
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
    let token = this.authService.token() || (typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null) || '';
    if (token && this.authService.isTokenExpired(token)) {
      token = '';
    }

    const payload: Record<string, any> = {
      query: query,
      skip_cache: skipCache,
      skipCache: skipCache
    };

    if (erpIntent) {
      payload['erp_intent'] = erpIntent;
      payload['erpIntent'] = erpIntent;
    }

    if (visibleFields && visibleFields.length > 0) {
      payload['visible_fields'] = visibleFields;
      payload['visibleFields'] = visibleFields;
    }

    if (formSchema && formSchema.length > 0) {
      payload['form_schema'] = formSchema;
      payload['formSchema'] = formSchema;
    }

    if (erpKey) {
      payload['erp_key'] = erpKey;
      payload['erpKey'] = erpKey;
    }

    if (threadId) {
      payload['thread_id'] = threadId;
      payload['threadId'] = threadId;
    }

    if (filters) {
      payload['scope'] = filters.scope;
      payload['course_id'] = null;
      payload['courseId'] = null;
      payload['module_id'] = filters.moduleId || null;
      payload['moduleId'] = filters.moduleId || null;
      payload['unit_id'] = filters.unitId || null;
      payload['unitId'] = filters.unitId || null;
      payload['lesson_id'] = filters.lessonId || null;
      payload['lessonId'] = filters.lessonId || null;
      if (filters.scope === 'lessons' || (filters.lessonIds && filters.lessonIds.length > 0)) {
        payload['scope'] = 'lessons';
        payload['lesson_ids'] = filters.lessonIds || [];
        payload['lessonIds'] = filters.lessonIds || [];
      }
      payload['level'] = filters.levelId || 0;
      payload['level_id'] = filters.levelId || null;
      payload['levelId'] = filters.levelId || null;
      payload['type'] = filters.typeId || 0;
      payload['type_id'] = filters.typeId || null;
      payload['typeId'] = filters.typeId || null;
    } else {
      payload['scope'] = lessonId ? 'lesson' : 'all';
      payload['course_id'] = null;
      payload['courseId'] = null;
      payload['module_id'] = null;
      payload['moduleId'] = null;
      payload['unit_id'] = null;
      payload['unitId'] = null;
      payload['lesson_id'] = lessonId || null;
      payload['lessonId'] = lessonId || null;
      payload['level'] = 0;
      payload['level_id'] = null;
      payload['levelId'] = null;
      payload['type'] = 0;
      payload['type_id'] = null;
      payload['typeId'] = null;
    }

    const startTime = Date.now();
    console.info('%c[CoPilot SSE] STREAM_START', 'color:#6366f1;font-weight:bold', { query, lessonId, filters });

    try {
      const initialHeaders: Record<string, string> = {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json'
      };
      if (token) {
        initialHeaders['Authorization'] = `Bearer ${token}`;
      }

      let activeResponse = await fetch(`${this.aiBaseUrl}/v1/search/stream`, {
        method: 'POST',
        headers: initialHeaders,
        body: JSON.stringify(payload)
      });

      if (activeResponse.status === 401) {
        const isEmbedded = typeof window !== 'undefined' && !!(
          (window as any).__LMS_COPILOT_EMBEDDED__ ||
          (window as any).__ERP_HOST__ ||
          (window as any).DynamicERP
        );
        const hasRefreshToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('refresh_token');

        if (hasRefreshToken && !isEmbedded) {
          console.warn('[CoPilot SSE] 401 Unauthorized. Attempting silent token refresh...');
          try {
            const refreshRes = await firstValueFrom(this.authService.refreshToken());
            const newToken = refreshRes?.token || this.authService.token() || '';
            const retryHeaders: Record<string, string> = {
              'Accept': 'text/event-stream',
              'Content-Type': 'application/json'
            };
            if (newToken) retryHeaders['Authorization'] = `Bearer ${newToken}`;
            activeResponse = await fetch(`${this.aiBaseUrl}/v1/search/stream`, {
              method: 'POST',
              headers: retryHeaders,
              body: JSON.stringify(payload)
            });
          } catch (refreshErr) {
            console.error('[CoPilot SSE] Silent refresh failed:', refreshErr);
            throw new Error('TOKEN_EXPIRED');
          }
        } else {
          console.warn('[CoPilot SSE] 401 in ERP/Guest mode. Retrying stream without token...');
          activeResponse = await fetch(`${this.aiBaseUrl}/v1/search/stream`, {
            method: 'POST',
            headers: {
              'Accept': 'text/event-stream',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }
      }

      if (!activeResponse.ok) {
        throw new Error(`HTTP ${activeResponse.status}: ${activeResponse.statusText}`);
      }

      const reader = activeResponse.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported on this browser.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let tokenCount = 0;
      let doneCalled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            // Comment or heartbeat — skip
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.substring('event:'.length).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring('data:'.length).trim();
            try {
              const data = JSON.parse(dataStr);

              if (currentEvent === 'sources' && onSources) {
                // Server may send { sources: [...] } OR a direct array — handle both
                let sourcesArray: CopilotSource[];
                if (Array.isArray(data)) {
                  sourcesArray = data;
                } else if (data && Array.isArray(data.sources)) {
                  sourcesArray = data.sources;
                } else {
                  sourcesArray = [data];
                }
                console.info('%c[CoPilot SSE] SOURCES', 'color:#10b981;font-weight:bold', sourcesArray);
                onSources(sourcesArray);

              } else if (currentEvent === 'form_fill' && onFormFill) {
                console.info('%c[CoPilot SSE] FORM_FILL', 'color:#ec4899;font-weight:bold', data);
                onFormFill(data as CopilotFormFillData);

              } else if (currentEvent === 'token' && onToken) {
                tokenCount++;
                const tokenText = typeof data === 'string' ? data : (data.text || data.token || '');
                onToken(tokenText);

              } else if (currentEvent === 'done' && onDone) {
                const elapsedMs = Date.now() - startTime;
                console.info('%c[CoPilot SSE] DONE', 'color:#6366f1;font-weight:bold',
                  { tokenCount, elapsedMs, meta: data });
                onDone(data);
                doneCalled = true;
              }
            } catch (e) {
              // Plain text token (non-JSON)
              if (currentEvent === 'token' && onToken) {
                tokenCount++;
                onToken(dataStr);
              }
            }
          }
        }
      }

      const totalMs = Date.now() - startTime;
      console.info('%c[CoPilot SSE] STREAM_END', 'color:#6366f1;font-weight:bold', { tokenCount, totalMs });
      if (onDone && !doneCalled) onDone();
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      console.error('[CoPilot SSE] STREAM_ERROR', { err, elapsedMs });
      if (onError) onError(err);
    }
  }

  sendFeedback(feedback: CopilotFeedbackRequest): Observable<any> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    console.info('%c[CoPilot Feedback] SENDING', 'color:#ec4899;font-weight:bold', feedback);
    return this.http.post(`${this.aiBaseUrl}/v1/search/feedback`, feedback, {
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
    const url = this.backendBaseUrl ? `${this.backendBaseUrl}/api/admin/ai/cache/clear` : '/api/admin/ai/cache/clear';
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
    const res = await fetch(`${this.aiBaseUrl}/v1/erp/navigation/resolve`, {
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
    const res = await fetch(`${this.aiBaseUrl}/v1/erp/form-fill/resolve-leftover`, {
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
    const res = await fetch(`${this.aiBaseUrl}/v1/erp/controls/resolve`, {
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
    try {
      await fetch(`${this.aiBaseUrl}/v1/erp/navigation/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ decision_id: decisionId, outcome })
      });
    } catch (err) {
      console.warn('[Copilot Service] Feedback delivery failed silently:', err);
    }
  }

  private activeAgentAbortController: AbortController | null = null;

  /**
   * Stops any ongoing Vision Agent execution immediately via AbortController.
   */
  stopAgentExecution(): void {
    if (this.activeAgentAbortController) {
      console.info('[Vision Agent SSE] Stopping active execution via AbortController...');
      this.activeAgentAbortController.abort();
      this.activeAgentAbortController = null;
    }
  }

  /**
   * Executes autonomous vision-agent workflow by streaming SSE events from POST /v1/erp/agent/stream
   */
  async streamAgentExecution(
    goal: string,
    cdpPort: number = 9222,
    cdpHost: string = '127.0.0.1',
    maxSteps: number = 15,
    sessionId?: string,
    onStep?: (step: AgentStepItem) => void,
    onDone?: (lastStep?: AgentStepItem) => void,
    onError?: (err: any) => void
  ): Promise<void> {
    // Abort previous execution if still active
    this.stopAgentExecution();
    const abortCtrl = new AbortController();
    this.activeAgentAbortController = abortCtrl;

    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let lastStep: AgentStepItem | undefined = undefined;

    try {
      const response = await fetch(`${this.aiBaseUrl}/v1/erp/agent/stream`, {
        method: 'POST',
        headers,
        signal: abortCtrl.signal,
        body: JSON.stringify({
          goal,
          cdp_port: cdpPort,
          cdp_host: cdpHost,
          max_steps: maxSteps,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Vision Agent HTTP error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        if (abortCtrl.signal.aborted) {
          try { await reader.cancel(); } catch (_) {}
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring('data:'.length).trim();
            try {
              const parsed: AgentStepItem = JSON.parse(dataStr);
              lastStep = parsed;
              if (onStep) onStep(parsed);
            } catch (e) {
              console.warn('[Vision Agent SSE] Failed to parse JSON:', dataStr, e);
            }
          }
        }
      }

      if (this.activeAgentAbortController === abortCtrl) {
        this.activeAgentAbortController = null;
      }
      if (onDone) onDone(lastStep);
    } catch (err: any) {
      if (this.activeAgentAbortController === abortCtrl) {
        this.activeAgentAbortController = null;
      }
      if (err?.name === 'AbortError' || abortCtrl.signal.aborted) {
        console.info('[Vision Agent SSE] Stream aborted by user.');
        const abortStep: AgentStepItem = {
          step: lastStep ? lastStep.step : 0,
          status: 'error',
          message: '🛑 تم إيقاف تنفيذ الوكيل البصري فوراً بواسطة المستخدم.'
        };
        if (onStep) onStep(abortStep);
        if (onDone) onDone(abortStep);
        return;
      }
      console.error('[Vision Agent SSE] Stream error:', err);
      if (onError) onError(err);
    }
  }
}

