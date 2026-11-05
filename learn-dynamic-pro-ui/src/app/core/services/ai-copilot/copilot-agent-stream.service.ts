import { Injectable, inject } from '@angular/core';
import { AuthService } from '../platform-core/auth.service';
import { CopilotNetworkService } from './copilot-network.config';

import { AgentStepItem } from '../../models/copilot.models';

export type { AgentStepItem };

@Injectable({
  providedIn: 'root'
})
export class CopilotAgentStreamService {
  private authService = inject(AuthService);
  private networkService = inject(CopilotNetworkService);

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
      const aiUrl = this.networkService.aiBaseUrl;
      const response = await fetch(`${aiUrl}/v1/erp/agent/stream`, {
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
