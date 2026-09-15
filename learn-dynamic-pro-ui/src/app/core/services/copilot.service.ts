import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class CopilotService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private aiBaseUrl = 'http://localhost:8000';

  async streamSearch(
    query: string,
    lessonId?: string,
    onSources?: (sources: CopilotSource[]) => void,
    onToken?: (token: string) => void,
    onDone?: (meta?: any) => void,
    onError?: (err: any) => void,
    skipCache: boolean = false
  ): Promise<void> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';

    const payload: Record<string, any> = {
      query: query,
      lesson_id: lessonId || null,
      scope: lessonId ? 'lesson' : 'global'
    };

    if (skipCache) {
      payload['skip_cache'] = true;
    }

    const startTime = Date.now();
    console.info('%c[CoPilot SSE] STREAM_START', 'color:#6366f1;font-weight:bold', { query, lessonId });

    try {
      const response = await fetch(`${this.aiBaseUrl}/v1/search/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
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
