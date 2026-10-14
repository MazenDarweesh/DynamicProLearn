import { Injectable, inject } from '@angular/core';
import { NavCandidateIn, NavResolution, NavScored, ControlIn } from '../models/erp-form.models';
import { normalizeArabicText } from './erp-form-driver.service';
import { CopilotService } from './copilot.service';

@Injectable({
  providedIn: 'root'
})
export class ErpNavigatorService {
  private copilotService = inject(CopilotService, { optional: true });
  private candidateElementsMap = new Map<string, HTMLElement>();

  /**
   * Detects if the specified screen is currently active in the DOM.
   * Completely dynamic: checks screen attributes and tags without hardcoded dictionaries.
   */
  isScreenActive(screenKey: string): boolean {
    if (!screenKey) return false;

    // 1. Check active tab or button with .active / .is-active specifically for this screenKey
    const activeTab = document.querySelector(
      `.screen-btn.active[data-screen="${screenKey}"], .dp-hdr__tab.is-active[data-screen="${screenKey}"], .dp-mods__card.is-active[data-screen="${screenKey}"]`
    );
    if (activeTab && this.isElementVisible(activeTab)) {
      return true;
    }

    // 2. Check if the active form content matches this screenKey
    const formContent = document.querySelector(`[data-screen-content="${screenKey}"]`);
    if (formContent && this.isElementVisible(formContent)) {
      return true;
    }

    // 3. Check active screen tag in ERP card header
    const activeTag = document.querySelector('.screen-tag code');
    if (activeTag && (activeTag.textContent || '').trim() === screenKey) {
      return true;
    }

    return false;
  }

  /**
   * Navigates to the target screen by simulating natural user clicks on ERP menu/tabs,
   * or dispatching navigation events.
   */
  async navigateToScreen(screenKey: string): Promise<boolean> {
    if (this.isScreenActive(screenKey)) {
      return true;
    }

    // 1. Dispatch custom event first so host / mock listeners switch screen immediately
    window.dispatchEvent(new CustomEvent('lms:navigate', {
      bubbles: true,
      composed: true,
      detail: { screenKey }
    }));

    // 2. Look for element with exact [data-screen="${screenKey}"]
    const directTarget = document.querySelector<HTMLElement>(`[data-screen="${screenKey}"]`);
    if (directTarget && this.isElementVisible(directTarget)) {
      directTarget.click();
      return await this.waitForScreenReady(screenKey, 3000);
    }

    // 3. Candidate map lookup
    const mapped = this.candidateElementsMap.get(screenKey);
    if (mapped) {
      mapped.click();
      return await this.waitForScreenReady(screenKey, 3000);
    }

    return await this.waitForScreenReady(screenKey, 2000);
  }

  /**
   * Waits for target screen DOM elements to become visible and ready.
   */
  async waitForScreenReady(screenKey: string, timeoutMs = 3000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (this.isScreenActive(screenKey)) {
        return true;
      }
      await this.delay(150);
    }
    return this.isScreenActive(screenKey);
  }

  /**
   * Scans visible interactive controls within a container for AI role classification.
   */
  scanVisibleControls(container?: HTMLElement): { controls: ControlIn[]; elementMap: Map<string, HTMLElement> } {
    const parent = container || (document.querySelector('[role="main"]') as HTMLElement) || document.body;
    const candidates = Array.from(parent.querySelectorAll<HTMLElement>('button, a[role="button"], input[type="button"], input[type="submit"]'));
    const controls: ControlIn[] = [];
    const elementMap = new Map<string, HTMLElement>();
    let idx = 1;

    for (const el of candidates) {
      if (el.closest('lms-ai-copilot, app-copilot-chat, nav, .dp-hdr')) continue;
      if (!this.isElementVisible(el)) continue;

      const id = el.getAttribute('data-action') || el.id || `ctrl_${idx++}`;
      const text = (el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
      if (!text && !el.getAttribute('class')) continue;

      controls.push({
        id,
        label: text.slice(0, 80) || id
      });
      elementMap.set(id, el);
    }
    return { controls, elementMap };
  }

  /**
   * Click the "New Document / Clear Form" button if present on the screen
   * to ensure a clean slate before filling each batch item.
   * Uses AI backend to resolve the button role with clean structural fallback.
   */
  async prepareFreshForm(): Promise<boolean> {
    const actionContainers = document.querySelectorAll<HTMLElement>(
      '.header-actions, .card-header, .erp-card, .dp-form-actions, [role="main"]'
    );
    const container = actionContainers.length > 0 ? actionContainers[0] : undefined;
    const { controls, elementMap } = this.scanVisibleControls(container);

    if (controls.length === 0) return false;

    // 1. AI-driven role classification
    if (this.copilotService) {
      try {
        const screenId = document.querySelector('.screen-tag code')?.textContent?.trim() || 'CURRENT_SCREEN';
        const res = await this.copilotService.resolveErpControls({
          screen_id: screenId,
          controls
        });

        const newFormId = res.roles ? res.roles['new_form'] : undefined;
        if (newFormId) {
          const btn = elementMap.get(newFormId);
          if (btn) {
            btn.click();
            await this.delay(300);
            return true;
          }
        }
      } catch (e) {
        console.warn('[ErpNavigator] AI control resolution fallback:', e);
      }
    }

    // 2. Structural attribute fallback (zero static keyword dictionaries)
    for (const ctrl of controls) {
      const el = elementMap.get(ctrl.id);
      if (!el) continue;
      const dataAction = el.getAttribute('data-action') || '';
      if (el.classList.contains('dp-btn--new') || dataAction === 'new') {
        el.click();
        await this.delay(300);
        return true;
      }
    }

    return false;
  }

  /**
   * Scans visible ERP screen items (cards, tabs, chips, mock buttons) from the active DOM.
   * Excludes any settings modals, headers, and Copilot widget elements.
   */
  scanVisibleCandidates(): NavCandidateIn[] {
    this.candidateElementsMap.clear();
    const candidates: NavCandidateIn[] = [];
    const seenLabels = new Set<string>();

    if (typeof document === 'undefined') {
      return candidates;
    }

    const badContainers = '.dp-set, #dpSettingsLabel, lms-ai-copilot, app-copilot-chat';
    const domSelectors = '.dp-mods__card, .dp-hdr__tab, .dp-cats__chip, .screen-btn, [data-screen]';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(domSelectors));

    let index = 1;
    for (const el of elements) {
      if (el.closest(badContainers)) continue;
      if (!this.isElementVisible(el)) continue;

      // Extract clean label: prioritize inner label element if present, else sanitize textContent
      const labelSpan = el.querySelector('.screen-label, .dp-mods__title, .dp-hdr__tabtxt, .dp-cats__txt');
      let rawText = (labelSpan?.textContent || el.textContent || '').trim();
      // Remove bracketed codes like [PURCHASE_INVOICE] from text for cleaner matching
      rawText = rawText.replace(/\[.*?\]/g, '').trim();

      if (!rawText || rawText.length < 2 || rawText.length > 150) continue;

      const normalized = normalizeArabicText(rawText);
      if (seenLabels.has(normalized)) continue;
      seenLabels.add(normalized);

      const candidateId = el.getAttribute('data-screen') || el.id || `candidate_${index++}`;
      this.candidateElementsMap.set(candidateId, el);

      candidates.push({
        id: candidateId,
        label: rawText,
        path: ['الرئيسية']
      });
    }

    return candidates;
  }

  /**
   * Resolves target screen using AI Backend (/v1/erp/navigation/resolve).
   * - 'go' (confidence >= 0.80): Navigates immediately and triggers prepareFreshForm().
   * - 'ask': Returns top 3 scored options for the user to select.
   * - 'clarify': Prompts user for clearer input.
   */
  async resolveAndNavigate(userMessage: string): Promise<{
    success: boolean;
    decision: 'go' | 'ask' | 'clarify';
    chosen?: NavScored;
    askOptions?: NavScored[];
    message?: string;
    rawResolution?: NavResolution;
  }> {
    const candidates = this.scanVisibleCandidates();
    if (candidates.length === 0) {
      return { success: false, decision: 'clarify', message: 'لم يتم العثور على أي شاشات متاحة في واجهة النظام حالياً.' };
    }

    if (!this.copilotService) {
      return { success: false, decision: 'clarify', message: 'خدمة الذكاء الاصطناعي غير متصلة.' };
    }

    try {
      const res = await this.copilotService.resolveErpNavigation({
        user_message: userMessage,
        candidates,
        current_path: []
      });
      console.info('%c[ErpNavigator] resolve response from backend:', 'color:#8b5cf6;font-weight:bold', res);

      if (res.decision === 'go' && res.candidates.length > 0) {
        const top = res.candidates[0];
        window.dispatchEvent(new CustomEvent('lms:navigate', {
          bubbles: true,
          composed: true,
          detail: { screenKey: top.id }
        }));
        const targetEl = this.candidateElementsMap.get(top.id);

        if (targetEl) {
          targetEl.click();
        } else {
          await this.navigateToScreen(top.id);
        }

        await this.delay(400);
        // Prepare fresh form if we reached the form/list
        await this.prepareFreshForm();

        return {
          success: true,
          decision: 'go',
          chosen: top,
          rawResolution: res
        };
      } else if (res.decision === 'ask') {
        return {
          success: false,
          decision: 'ask',
          askOptions: res.candidates.slice(0, 3),
          rawResolution: res
        };
      } else {
        return {
          success: false,
          decision: 'clarify',
          message: 'يرجى توضيح اسم الشاشة أو العملية المطلوبة (مثال: فاتورة مشتريات، تسجيل عميل).',
          rawResolution: res
        };
      }
    } catch (err: any) {
      console.error('[ErpNavigator] resolveAndNavigate error', err);
      return {
        success: false,
        decision: 'clarify',
        message: 'حدث خطأ أثناء التواصل مع محرك الذكاء الاصطناعي، يرجى المحاولة لاحقاً.'
      };
    }
  }

  private isElementVisible(el: Element): boolean {
    const htmlEl = el as HTMLElement;
    return !!(htmlEl.offsetWidth || htmlEl.offsetHeight || htmlEl.getClientRects().length);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

