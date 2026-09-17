import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, shareReplay, BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

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
  scope: 'all' | 'module' | 'unit' | 'lesson';
  moduleId?: string;
  unitId?: string;
  lessonId?: string;
  levelId?: string;
  typeId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CopilotService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private aiBaseUrl = 'http://localhost:8000';
  private filterData$?: Observable<StudentCopilotFilterData>;

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
      this.filterData$ = this.http.get<StudentCopilotFilterData>('/api/student/copilot-filters').pipe(
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
    threadId?: string
  ): Promise<void> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';

    const payload: Record<string, any> = {
      query: query,
      skip_cache: skipCache,
      skipCache: skipCache
    };

    if (threadId) {
      payload['thread_id'] = threadId;
      payload['threadId'] = threadId;
    }

    if (filters) {
      payload['scope'] = filters.scope;
      if (filters.moduleId) {
        payload['module_id'] = filters.moduleId;
        payload['moduleId'] = filters.moduleId;
      }
      if (filters.unitId) {
        payload['unit_id'] = filters.unitId;
        payload['unitId'] = filters.unitId;
      }
      if (filters.lessonId) {
        payload['lesson_id'] = filters.lessonId;
        payload['lessonId'] = filters.lessonId;
      }
      if (filters.levelId) {
        payload['level_id'] = filters.levelId;
        payload['levelId'] = filters.levelId;
      }
      if (filters.typeId) {
        payload['type_id'] = filters.typeId;
        payload['typeId'] = filters.typeId;
      }
    } else {
      payload['lesson_id'] = lessonId || null;
      payload['lessonId'] = lessonId || null;
      payload['scope'] = lessonId ? 'lesson' : 'all';
    }

    const startTime = Date.now();
    console.info('%c[CoPilot SSE] STREAM_START', 'color:#6366f1;font-weight:bold', { query, lessonId, filters });

    try {
      let activeResponse = await fetch(`${this.aiBaseUrl}/v1/search/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (activeResponse.status === 401) {
        console.warn('[CoPilot SSE] 401 Unauthorized. Attempting silent token refresh...');
        try {
          const refreshRes = await firstValueFrom(this.authService.refreshToken());
          const newToken = refreshRes?.token || this.authService.token() || '';
          activeResponse = await fetch(`${this.aiBaseUrl}/v1/search/stream`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${newToken}`,
              'Accept': 'text/event-stream',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        } catch (refreshErr) {
          console.error('[CoPilot SSE] Silent refresh failed:', refreshErr);
          throw new Error('TOKEN_EXPIRED');
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
    return this.http.post<{ status: string; message: string }>(
      '/api/admin/ai/cache/clear',
      {},
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
  }
}
