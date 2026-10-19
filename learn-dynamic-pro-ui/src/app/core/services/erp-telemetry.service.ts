import { Injectable, inject } from '@angular/core';
import { CopilotService } from './copilot.service';

export interface TelemetryEventPayload {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'ERROR' | 'GENERAL';
  event: string;
  details?: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class ErpTelemetryService {
  private copilotService = inject(CopilotService, { optional: true });

  private sessionId = this.generateSessionId();
  private screenKey: string | null = null;
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

  setScreenKey(key: string | null) {
    this.screenKey = key;
  }

  resetSession(): string {
    this.flush();
    this.sessionId = this.generateSessionId();
    if (typeof window !== 'undefined') {
      (window as any).__COPILOT_SESSION_ID__ = this.sessionId;
      (window as any).__COPILOT_SESSION_LOG__ = [];
    }
    this.log('GENERAL', 'New chat session started', { sessionId: this.sessionId }, 'INFO');
    return this.sessionId;
  }

  log(
    stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'ERROR' | 'GENERAL',
    event: string,
    details?: Record<string, any>,
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO'
  ): void {
    const timestamp = new Date().toISOString();
    const payload: TelemetryEventPayload = {
      timestamp,
      level,
      stage,
      event,
      details
    };

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

  logBridge(method: string, args?: any, result?: any, error?: any): void {
    const level = error ? 'ERROR' : 'INFO';
    this.log(
      'BRIDGE',
      `DynamicERP.${method}()`,
      { args, result, error: error ? String(error) : undefined },
      level
    );
  }

  logScan(schemas: any[], context?: string): void {
    const summary = schemas.map(s => ({
      key: s.key,
      label: s.label,
      kind: s.kind,
      disabled: s.disabled
    }));
    this.log(
      'SCAN',
      `Collected form schema (${schemas.length} fields) [${context || 'active root'}]`,
      { fieldsCount: schemas.length, fields: summary }
    );
  }

  logFill(field: string, status: string, message: string, value?: any): void {
    const level = status === 'filled' ? 'INFO' : status === 'not_found' ? 'WARN' : 'DEBUG';
    this.log(
      'FILL',
      `Field '${field}' -> ${status}: ${message}`,
      { field, status, message, value },
      level
    );
  }

  logError(
    stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'ERROR' | 'GENERAL',
    event: string,
    err?: any
  ): void {
    this.log(stage, event, { error: err ? String(err) : undefined, stack: err?.stack }, 'ERROR');
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return;

    const eventsToSend = [...this.buffer];
    this.buffer = [];

    const batch = {
      session_id: this.sessionId,
      screen_key: this.screenKey,
      events: eventsToSend
    };

    if (this.copilotService) {
      this.copilotService.sendErpTelemetry(batch).catch(err => {
        console.warn('[ErpTelemetry] Flush failed, attempting keepalive fallback:', err);
        this.sendKeepalive(batch);
      });
    } else {
      this.sendKeepalive(batch);
    }
  }

  private sendKeepalive(batch: any): void {
    if (typeof window === 'undefined') return;
    try {
      const url = `${this.copilotService?.getAiBaseUrl() || 'http://localhost:8000'}/v1/erp/telemetry`;
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
    const batch = {
      session_id: this.sessionId,
      screen_key: this.screenKey,
      events: [...this.buffer]
    };
    this.buffer = [];
    this.sendKeepalive(batch);
  }
}
