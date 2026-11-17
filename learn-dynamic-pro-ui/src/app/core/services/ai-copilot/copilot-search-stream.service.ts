import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../platform-core/auth.service';
import { CopilotNetworkService } from './copilot-network.config';
import { ErpTelemetryService, TelemetryEventPayload } from '../erp-automation/erp-telemetry.service';
import {
  CopilotSource,
  CopilotFormFillData,
  CopilotFilterState,
  ChatHistoryMessage,
  GeneralChatNavAction,
  GeneralChatToolEvent,
  GeneralChatDoneMeta,
  GeneralChatStreamParams
} from '../../models/copilot.models';

export type {
  CopilotSource,
  CopilotFormFillData,
  CopilotFilterState,
  ChatHistoryMessage,
  GeneralChatNavAction,
  GeneralChatToolEvent,
  GeneralChatDoneMeta,
  GeneralChatStreamParams
};

interface SseEndpointHandlers {
  onEvent: (event: string, data: any) => void;
  onToken?: (token: string) => void;
  onDone?: (meta?: any) => void;
  onError?: (err: any) => void;
  telemetryStage?: TelemetryEventPayload['stage'];
}

@Injectable({
  providedIn: 'root'
})
export class CopilotSearchStreamService {
  private authService = inject(AuthService);
  private networkService = inject(CopilotNetworkService);
  private telemetry = inject(ErpTelemetryService, { optional: true });

  private getActiveScreenFromWindow(): any {
    return typeof window !== 'undefined' && (window as any).DynamicERP?.getActiveScreen
      ? (window as any).DynamicERP.getActiveScreen()
      : null;
  }

  private extractSourcesArray(data: any): CopilotSource[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.sources)) return data.sources;
    return [data];
  }

  /**
   * Shared SSE fetch + 401 refresh/guest retry + ReadableStream parser for AI streaming endpoints.
   */
  private async streamSseEndpoint(
    endpointPath: string,
    payload: Record<string, any>,
    handlers: SseEndpointHandlers
  ): Promise<void> {
    let token =
      this.authService.token() ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('jwt_token') : null) ||
      '';
    if (token && this.authService.isTokenExpired(token)) {
      token = '';
    }

    const startTime = Date.now();
    const aiUrl = this.networkService.aiBaseUrl;
    const url = `${aiUrl}${endpointPath}`;
    const buildHeaders = (bearer?: string): Record<string, string> => {
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json'
      };
      if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
      return headers;
    };

    try {
      let activeResponse = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(token || undefined),
        body: JSON.stringify(payload)
      });

      if (activeResponse.status === 401) {
        const isEmbedded =
          typeof window !== 'undefined' &&
          !!(
            (window as any).__LMS_COPILOT_EMBEDDED__ ||
            (window as any).__ERP_HOST__ ||
            (window as any).DynamicERP
          );
        const hasRefreshToken =
          typeof localStorage !== 'undefined' && !!localStorage.getItem('refresh_token');

        if (hasRefreshToken && !isEmbedded) {
          console.warn('[CoPilot SSE] 401 Unauthorized. Attempting silent token refresh...');
          try {
            const refreshRes = await firstValueFrom(this.authService.refreshToken());
            const newToken = refreshRes?.token || this.authService.token() || '';
            activeResponse = await fetch(url, {
              method: 'POST',
              headers: buildHeaders(newToken || undefined),
              body: JSON.stringify(payload)
            });
          } catch (refreshErr) {
            console.error('[CoPilot SSE] Silent refresh failed:', refreshErr);
            throw new Error('TOKEN_EXPIRED');
          }
        } else {
          console.warn('[CoPilot SSE] 401 in ERP/Guest mode. Retrying stream without token...');
          activeResponse = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(),
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
      let currentEvent = '';
      let tokenCount = 0;
      let ttftMs: number | null = null;
      let doneCalled = false;
      let errorCalled = false;

      const processLine = (line: string): void => {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEvent = '';
          return;
        }
        if (trimmed.startsWith(':')) {
          return;
        }
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.substring('event:'.length).trim();
          return;
        }
        if (!trimmed.startsWith('data:')) {
          return;
        }

        const dataStr = trimmed.substring('data:'.length).trim();
        try {
          const data = JSON.parse(dataStr);

          if (currentEvent === 'token') {
            tokenCount++;
            if (tokenCount === 1) {
              ttftMs = Date.now() - startTime;
            }
            const tokenText = typeof data === 'string' ? data : (data?.text ?? data?.token ?? '');
            handlers.onToken?.(tokenText);
          } else if (currentEvent === 'done') {
            const elapsedMs = Date.now() - startTime;
            if (data && typeof data === 'object') {
              data.metrics = {
                ...(data.metrics || {}),
                ttftMs,
                streamDurationMs: elapsedMs,
                tokenCount
              };
            }
            console.info('%c[CoPilot SSE] DONE', 'color:#6366f1;font-weight:bold', {
              tokenCount,
              ttftMs,
              elapsedMs,
              meta: data
            });
            this.telemetry?.log(
              handlers.telemetryStage || 'AI_EXTRACT',
              `SSE stream completed (${tokenCount} tokens, TTFT: ${ttftMs ?? 0}ms)`,
              {
                tokenCount,
                ttftMs,
                totalLatencyMs: elapsedMs,
                cacheHit: data?.cache_hit,
                provenance: data?.provenance,
                mcpEnabled: data?.mcp_enabled,
                provider: data?.provider,
                model: data?.model
              },
              'INFO',
              elapsedMs
            );
            handlers.onDone?.(data);
            doneCalled = true;
          } else if (currentEvent === 'error') {
            errorCalled = true;
            handlers.onError?.(data);
          } else {
            handlers.onEvent(currentEvent, data);
          }
        } catch {
          if (currentEvent === 'token') {
            tokenCount++;
            if (tokenCount === 1) {
              ttftMs = Date.now() - startTime;
            }
            handlers.onToken?.(dataStr);
          } else if (currentEvent === 'error') {
            errorCalled = true;
            handlers.onError?.(new Error(dataStr));
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          processLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split('\n')) {
          processLine(line);
        }
      }

      const totalMs = Date.now() - startTime;
      console.info('%c[CoPilot SSE] STREAM_END', 'color:#6366f1;font-weight:bold', {
        tokenCount,
        ttftMs,
        totalMs
      });
      if (handlers.onDone && !doneCalled && !errorCalled) {
        handlers.onDone();
      }
    } catch (err) {
      const elapsedMs = Date.now() - startTime;
      console.error('[CoPilot SSE] STREAM_ERROR', { err, elapsedMs });
      handlers.onError?.(err);
    }
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
    const payload: Record<string, any> = {
      query,
      skip_cache: skipCache,
      skipCache
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

    const activeScreen = this.getActiveScreenFromWindow();
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

    console.info('%c[CoPilot SSE] STREAM_START', 'color:#6366f1;font-weight:bold', { query, lessonId, filters });

    await this.streamSseEndpoint('/v1/search/stream', payload, {
      onEvent: (event, data) => {
        if (event === 'sources' && onSources) {
          const sourcesArray = this.extractSourcesArray(data);
          console.info('%c[CoPilot SSE] SOURCES', 'color:#10b981;font-weight:bold', sourcesArray);
          onSources(sourcesArray);
        } else if (event === 'form_fill' && onFormFill) {
          console.info('%c[CoPilot SSE] FORM_FILL', 'color:#ec4899;font-weight:bold', data);
          onFormFill(data as CopilotFormFillData);
        }
      },
      onToken,
      onDone,
      onError,
      telemetryStage: 'AI_EXTRACT'
    });
  }

  /**
   * Streams unified general chat + LMS RAG + ERP navigation via POST /v1/erp/chat/stream.
   */
  async streamGeneralChat(params: GeneralChatStreamParams): Promise<void> {
    const activeScreen = this.getActiveScreenFromWindow();
    const effectiveErpKey = (params.erpKey || activeScreen?.pageName || '').trim() || null;
    const effectiveScreenKey =
      (params.activeScreenKey || activeScreen?.screenKey || activeScreen?.pageName || effectiveErpKey || '').trim() ||
      null;

    const payload: Record<string, any> = {
      query: params.query,
      history: params.history ?? [],
      thread_id: params.threadId ?? null,
      erp_key: effectiveErpKey,
      active_screen_key: effectiveScreenKey,
      lesson_id: params.lessonId ?? null,
      lesson_ids: params.lessonIds ?? null,
      candidates: params.candidates ?? [],
      trace_id: params.traceId ?? null
    };

    console.info('%c[CoPilot SSE] GENERAL_CHAT_START', 'color:#6366f1;font-weight:bold', {
      query: params.query,
      erpKey: effectiveErpKey,
      activeScreenKey: effectiveScreenKey,
      historyCount: payload['history'].length,
      candidatesCount: payload['candidates'].length
    });

    await this.streamSseEndpoint('/v1/erp/chat/stream', payload, {
      onEvent: (event, data) => {
        if (event === 'sources' && params.onSources) {
          const sourcesArray = this.extractSourcesArray(data);
          console.info('%c[CoPilot SSE] SOURCES', 'color:#10b981;font-weight:bold', sourcesArray);
          params.onSources(sourcesArray);
        } else if (event === 'nav_action' && params.onNavAction) {
          console.info('%c[CoPilot SSE] NAV_ACTION', 'color:#3b82f6;font-weight:bold', data);
          params.onNavAction(data as GeneralChatNavAction);
        } else if ((event === 'tool_start' || event === 'tool_end') && params.onToolEvent) {
          params.onToolEvent({
            type: event,
            ...(typeof data === 'object' && data !== null ? data : { data })
          });
        }
      },
      onToken: params.onToken,
      onDone: params.onDone,
      onError: params.onError,
      telemetryStage: 'GENERAL'
    });
  }
}
