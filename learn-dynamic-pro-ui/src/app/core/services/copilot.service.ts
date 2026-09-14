import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface CopilotSource {
  title?: string;
  lesson_title?: string;
  timestamp?: string;
  video_url?: string;
  relevance_score?: number;
}

export interface CopilotFeedbackRequest {
  query: string;
  answer: string;
  rating: 'up' | 'down';
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
    onError?: (err: any) => void
  ): Promise<void> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';

    const payload = {
      query: query,
      lesson_id: lessonId || null,
      scope: lessonId ? 'lesson' : 'global'
    };

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
            // Comment or heartbeat
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.substring('event:'.length).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring('data:'.length).trim();
            try {
              const data = JSON.parse(dataStr);
              if (currentEvent === 'sources' && onSources) {
                onSources(Array.isArray(data) ? data : [data]);
              } else if (currentEvent === 'token' && onToken) {
                onToken(typeof data === 'string' ? data : (data.text || data.token || ''));
              } else if (currentEvent === 'done' && onDone) {
                onDone(data);
              }
            } catch (e) {
              // If plain text token
              if (currentEvent === 'token' && onToken) {
                onToken(dataStr);
              }
            }
          }
        }
      }

      if (onDone) onDone();
    } catch (err) {
      console.error('Copilot Stream Error:', err);
      if (onError) onError(err);
    }
  }

  sendFeedback(feedback: CopilotFeedbackRequest): Observable<any> {
    const token = this.authService.token() || localStorage.getItem('jwt_token') || '';
    return this.http.post(`${this.aiBaseUrl}/v1/search/feedback`, feedback, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  }
}
