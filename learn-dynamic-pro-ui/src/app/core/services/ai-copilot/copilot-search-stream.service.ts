import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../platform-core/auth.service';
import { CopilotNetworkService } from './copilot-network.config';
import { ErpTelemetryService } from '../erp-automation/erp-telemetry.service';
import {
  CopilotSource,
  CopilotFormFillData,
  CopilotFilterState
} from '../../models/copilot.models';

export type {
  CopilotSource,
  CopilotFormFillData,
  CopilotFilterState
};

@Injectable({
  providedIn: 'root'
})
export class CopilotSearchStreamService {
  private authService = inject(AuthService);
  private networkService = inject(CopilotNetworkService);
  private telemetry = inject(ErpTelemetryService, { optional: true });

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

    const activeScreen = (typeof window !== 'undefined' && (window as any).DynamicERP?.getActiveScreen)
      ? (window as any).DynamicERP.getActiveScreen()
      : null;
    if (activeScreen?.pageId) {
      payload['page_id'] = activeScreen.pageId;
      payload['pageId'] = activeScreen.pageId;
    }

    const effectiveKey = erpKey || activeScreen?.pageName;
    if (effectiveKey) {
      payload['erp_key'] = effectiveKey.trim();
      payload['erpKey'] = effectiveKey.trim();
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

      const aiUrl = this.networkService.aiBaseUrl;
      let activeResponse = await fetch(`${aiUrl}/v1/search/stream`, {
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
            activeResponse = await fetch(`${aiUrl}/v1/search/stream`, {
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
          activeResponse = await fetch(`${aiUrl}/v1/search/stream`, {
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
      let ttftMs: number | null = null;
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
                if (tokenCount === 1) {
                  ttftMs = Date.now() - startTime;
                }
                const tokenText = typeof data === 'string' ? data : (data.text || data.token || '');
                onToken(tokenText);

              } else if (currentEvent === 'done' && onDone) {
                const elapsedMs = Date.now() - startTime;
                if (data && typeof data === 'object') {
                  data.metrics = {
                    ...(data.metrics || {}),
                    ttftMs,
                    streamDurationMs: elapsedMs,
                    tokenCount
                  };
                }
                console.info('%c[CoPilot SSE] DONE', 'color:#6366f1;font-weight:bold',
                  { tokenCount, ttftMs, elapsedMs, meta: data });
                this.telemetry?.log(
                  'AI_EXTRACT',
                  `SSE stream completed (${tokenCount} tokens, TTFT: ${ttftMs ?? 0}ms)`,
                  {
                    tokenCount,
                    ttftMs,
                    totalLatencyMs: elapsedMs,
                    cacheHit: data?.cache_hit,
                    provenance: data?.provenance
                  },
                  'INFO',
                  elapsedMs
                );
                onDone(data);
                doneCalled = true;
              }
            } catch (e) {
              if (currentEvent === 'token' && onToken) {
                tokenCount++;
                if (tokenCount === 1) {
                  ttftMs = Date.now() - startTime;
                }
                onToken(dataStr);
              }
            }
          }
        }
      }

      const totalMs = Date.now() - startTime;
      console.info('%c[CoPilot SSE] STREAM_END', 'color:#6366f1;font-weight:bold', { tokenCount, ttftMs, totalMs });
      if (onDone && !doneCalled) onDone();
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      console.error('[CoPilot SSE] STREAM_ERROR', { err, elapsedMs });
      if (onError) onError(err);
    }
  }
}
