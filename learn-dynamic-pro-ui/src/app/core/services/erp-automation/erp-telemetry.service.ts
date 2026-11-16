import { Injectable, inject, Injector } from '@angular/core';
import { CopilotService } from '../ai-copilot/copilot.service';

import { TelemetryEventPayload, TelemetryBatchPayload } from '../../models/erp-telemetry.models';

export type { TelemetryEventPayload, TelemetryBatchPayload };

@Injectable({
  providedIn: 'root'
})
export class ErpTelemetryService {
  private injector = inject(Injector);

  private get copilotService(): CopilotService | null {
    try {
      return this.injector.get(CopilotService, null);
    } catch {
      return null;
    }
  }

  private static readonly MAX_BUFFER_SIZE = 100;
  private static readonly MAX_SCAN_FIELDS = 50;
  private static readonly SENSITIVE_KEY_PATTERN =
    /^(password|token|secret|authorization|api_?key|access_?token|refresh_?token)$/i;

  private sessionId = this.generateSessionId();
  private screenKey: string | null = null;
  private currentTraceId: string | null = null;
  private lastSchemaSignatures = new Map<string, string>();
  private lastSchemaKeysMap = new Map<string, string[]>();
  private buffer: TelemetryEventPayload[] = [];
  private flushTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__COPILOT_SESSION_ID__ = this.sessionId;
      (window as any).__COPILOT_SESSION_LOG__ = [];
      window.addEventListener('beforeunload', () => this.flushSync());
    }
  }

  private generateSessionId(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const rand = Math.random().toString(36).substring(2, 6);
    return `session_${dStr}_${rand}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setScreenKey(key: string | null): void {
    this.screenKey = key;
  }

  setTraceId(traceId: string | null): void {
    this.currentTraceId = traceId;
  }

  getTraceId(): string | null {
    return this.currentTraceId;
  }

  resetSession(): string {
    this.flush();
    this.sessionId = this.generateSessionId();
    this.currentTraceId = null;
    this.lastSchemaSignatures.clear();
    this.lastSchemaKeysMap.clear();
    if (typeof window !== 'undefined') {
      (window as any).__COPILOT_SESSION_ID__ = this.sessionId;
      (window as any).__COPILOT_SESSION_LOG__ = [];
    }
    this.log('GENERAL', 'New chat session started', { sessionId: this.sessionId }, 'INFO');
    return this.sessionId;
  }

  private sanitizeDetails(value: any, depth = 0): any {
    if (depth > 5 || value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeDetails(item, depth + 1));
    }
    if (typeof value === 'object') {
      const sanitized: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (ErpTelemetryService.SENSITIVE_KEY_PATTERN.test(k.trim())) {
          sanitized[k] = '[REDACTED]';
        } else {
          sanitized[k] = this.sanitizeDetails(v, depth + 1);
        }
      }
      return sanitized;
    }
    return value;
  }

  log(
    stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'NAV' | 'ERROR' | 'GENERAL' | 'SESSION_END',
    event: string,
    details?: Record<string, any>,
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO',
    durationMs?: number
  ): void {
    const timestamp = new Date().toISOString();
    const safeDetails = details ? this.sanitizeDetails(details) : undefined;
    const payload: TelemetryEventPayload = {
      timestamp,
      level,
      stage,
      event,
      traceId: this.currentTraceId || undefined,
      durationMs: durationMs !== undefined ? durationMs : safeDetails?.['durationMs'],
      details: safeDetails
    };

    this.printDevToolsBadge(payload);

    this.buffer.push(payload);

    // Maintain live ring buffer on window for immediate developer inspection
    if (typeof window !== 'undefined' && Array.isArray((window as any).__COPILOT_SESSION_LOG__)) {
      (window as any).__COPILOT_SESSION_LOG__.push(payload);
      if ((window as any).__COPILOT_SESSION_LOG__.length > 300) {
        (window as any).__COPILOT_SESSION_LOG__.shift();
      }
    }

    // Auto-flush debounced or immediately on batch limit / errors
    if (this.buffer.length >= 8 || level === 'ERROR') {
      this.flush();
    } else {
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), 300);
    }
  }

  private printDevToolsBadge(payload: TelemetryEventPayload): void {
    if (typeof window === 'undefined') return;
    const colors: Record<string, string> = {
      AI_EXTRACT: '#8b5cf6',
      USER_QUERY: '#3b82f6',
      BRIDGE: '#06b6d4',
      SCAN: '#10b981',
      FILL: '#f59e0b',
      GRID: '#ec4899',
      NAV: '#6366f1',
      ERROR: '#ef4444',
      SESSION_END: '#64748b',
      GENERAL: '#6b7280'
    };
    const bg = colors[payload.stage] || '#6b7280';
    const tag = `[${payload.stage}]`;
    const dur = payload.durationMs !== undefined ? ` (${payload.durationMs}ms)` : '';
    const badgeStyle = `background:${bg};color:#fff;padding:2px 6px;border-radius:3px;font-weight:600;font-size:11px;`;
    const resetStyle = 'color:inherit;font-weight:normal;';

    const logFn =
      payload.level === 'ERROR'
        ? console.error
        : payload.level === 'WARN'
        ? console.warn
        : payload.level === 'DEBUG'
        ? console.debug
        : console.log;

    if (payload.details && Object.keys(payload.details).length > 0) {
      logFn(`%c${tag}%c ${payload.event}${dur}`, badgeStyle, resetStyle, payload.details);
    } else {
      logFn(`%c${tag}%c ${payload.event}${dur}`, badgeStyle, resetStyle);
    }
  }

  logBridge(method: string, args?: any, result?: any, error?: any, durationMs?: number): void {
    const level = error ? 'ERROR' : 'INFO';
    this.log(
      'BRIDGE',
      `DynamicERP.${method}()`,
      { args, result, error: error ? String(error) : undefined },
      level,
      durationMs
    );
  }

  logScan(schemas: any[], context?: string): void {
    const validLabels = new Set(
      schemas
        .filter((s) => s?.key && s.key !== 'undefined' && s?.label)
        .map((s) => String(s.label))
    );
    const filteredSchemas = schemas.filter(
      (s) => (s?.key && s.key !== 'undefined') || !s?.label || !validLabels.has(String(s.label))
    );

    const bucketKey = this.screenKey || '__default__';
    const signature = filteredSchemas.map(s => `${s.key}:${s.disabled ? '0' : '1'}`).join('|');
    const currentKeys = filteredSchemas.map(s => s.key);
    const prevSignature = this.lastSchemaSignatures.get(bucketKey) || '';
    const prevKeys = this.lastSchemaKeysMap.get(bucketKey) || [];

    if (prevSignature && prevSignature === signature) {
      this.log(
        'SCAN',
        `Schema verified: Unchanged (${filteredSchemas.length} fields, stable)`,
        { fieldsCount: filteredSchemas.length, unchanged: true },
        'DEBUG'
      );
      return;
    }

    const isFirstScan = !prevSignature;
    const added = currentKeys.filter(k => !prevKeys.includes(k));
    const removed = prevKeys.filter(k => !currentKeys.includes(k));

    this.lastSchemaSignatures.set(bucketKey, signature);
    this.lastSchemaKeysMap.set(bucketKey, currentKeys);

    if (isFirstScan) {
      const summary = filteredSchemas
        .slice(0, ErpTelemetryService.MAX_SCAN_FIELDS)
        .map(s => ({
          key: s.key,
          label: s.label,
          kind: s.kind,
          disabled: s.disabled
        }));
      this.log(
        'SCAN',
        `Collected form schema (${filteredSchemas.length} fields) [${context || 'active root'}]`,
        {
          fieldsCount: filteredSchemas.length,
          fieldsTruncated: filteredSchemas.length > ErpTelemetryService.MAX_SCAN_FIELDS,
          fields: summary
        },
        'INFO'
      );
    } else {
      this.log(
        'SCAN',
        `Schema changed: +${added.length} added, -${removed.length} removed (${filteredSchemas.length} total)`,
        {
          fieldsCount: filteredSchemas.length,
          schemaDiff: { added, removed, count: filteredSchemas.length }
        },
        'INFO'
      );
    }
  }

  logFill(field: string, status: string, message: string, value?: any, durationMs?: number): void {
    const level = status === 'filled' ? 'INFO' : status === 'not_found' ? 'WARN' : 'DEBUG';
    this.log(
      'FILL',
      `Field '${field}' -> ${status}: ${message}`,
      { field, status, message, value },
      level,
      durationMs
    );
  }

  logNav(screenKey: string, status: 'success' | 'failed' | 'in_progress', message: string, durationMs?: number): void {
    const level = status === 'success' ? 'INFO' : status === 'failed' ? 'ERROR' : 'DEBUG';
    this.log(
      'NAV',
      `Navigation to '${screenKey}' -> ${status}: ${message}`,
      { screenKey, status, message, durationMs },
      level,
      durationMs
    );
  }

  logSessionEnd(summary: Record<string, any>, durationMs?: number): void {
    this.log(
      'SESSION_END',
      `Session completed: ${summary['success'] ? 'SUCCESS' : 'FAILED'} (${summary['fieldsFilled'] || 0} fields, ${summary['rowsFilled'] || 0} rows)`,
      summary,
      summary['success'] ? 'INFO' : 'WARN',
      durationMs
    );
    this.flush();
  }

  logError(
    stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'NAV' | 'ERROR' | 'GENERAL' | 'SESSION_END',
    event: string,
    err?: any
  ): void {
    this.log(stage, event, { error: err ? String(err) : undefined, stack: err?.stack }, 'ERROR');
  }

  private requeueEvents(events: TelemetryEventPayload[]): void {
    const combined = [...events, ...this.buffer];
    this.buffer =
      combined.length > ErpTelemetryService.MAX_BUFFER_SIZE
        ? combined.slice(combined.length - ErpTelemetryService.MAX_BUFFER_SIZE)
        : combined;
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return;

    const eventsToSend = [...this.buffer];
    this.buffer = [];

    const batch: TelemetryBatchPayload = {
      session_id: this.sessionId,
      screen_key: this.screenKey,
      trace_id: this.currentTraceId || undefined,
      events: eventsToSend
    };

    if (this.copilotService) {
      this.copilotService.sendErpTelemetry(batch).catch(err => {
        console.warn('[ErpTelemetry] Flush failed, re-queuing events and attempting keepalive:', err);
        this.requeueEvents(eventsToSend);
        this.sendKeepalive(batch);
      });
    } else {
      this.sendKeepalive(batch);
    }
  }

  private sendKeepalive(batch: any): void {
    if (typeof window === 'undefined') return;
    try {
      const baseUrl = this.copilotService?.getAiBaseUrl();
      if (!baseUrl) return;
      const url = `${baseUrl}/v1/erp/telemetry`;
      const data = JSON.stringify(batch);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true
        }).catch(() => {});
      }
    } catch {}
  }

  private flushSync(): void {
    if (this.buffer.length === 0) return;
    const batch: TelemetryBatchPayload = {
      session_id: this.sessionId,
      screen_key: this.screenKey,
      trace_id: this.currentTraceId || undefined,
      events: [...this.buffer]
    };
    this.buffer = [];
    this.sendKeepalive(batch);
  }
}

