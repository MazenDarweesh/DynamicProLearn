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
  /**
   * Detects if the specified screen is currently active in the DOM.
   * Completely dynamic: checks screen attributes, tabs, and page headers without hardcoded dictionaries.
   */
  isScreenActive(screenKey: string): boolean {
    if (!screenKey) return false;
    const normalizedKey = normalizeArabicText(screenKey);

    // 1. Check active tab or button with .active / .is-active specifically for this screenKey
    const activeTab = document.querySelector(
      `.screen-btn.active[data-screen="${screenKey}"], .dp-hdr__tab.is-active[data-screen="${screenKey}"], .dp-mods__card.is-active[data-screen="${screenKey}"], .dp-pgs__mod.is-active[data-screen="${screenKey}"]`
    );
    if (activeTab && this.isElementVisible(activeTab)) {
      return true;
    }

    // 2. Check active header tab text
    const activeHdrTab = document.querySelector('.dp-hdr__tab.is-active .dp-hdr__tab-name, .dp-hdr__tab.is-active, .dp-hdr__trig-label');
    if (activeHdrTab && normalizeArabicText(activeHdrTab.textContent || '') === normalizedKey) {
      return true;
    }

    // 3. Check active module text
    const activeMod = document.querySelector('.dp-pgs__mod.is-active .dp-pgs__mod-name, .dp-pgs__mod.is-active');
    if (activeMod && normalizeArabicText(activeMod.textContent || '') === normalizedKey) {
      return true;
    }

    // 4. Check if the active form content matches this screenKey
    const formContent = document.querySelector(`[data-screen-content="${screenKey}"]`);
    if (formContent && this.isElementVisible(formContent)) {
      return true;
    }

    // 5. Check active screen tag in ERP card header or main page title
    const activeTag = document.querySelector('.screen-tag code, .page-title, h1, .dp-hdr__title');
    if (activeTag && normalizeArabicText(activeTag.textContent || '') === normalizedKey) {
      return true;
    }

    return false;
  }

  /**
   * Simulates a natural user click event sequence on an ERP DOM element.
   * Dispatches mousedown, mouseup, and click with bubbles and cancelable flags.
   */
  simulateClick(el: HTMLElement): void {
    if (!el) return;
    try {
      el.focus?.();
    } catch {}
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    el.click();
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

    // 2. Candidate map lookup
    const mapped = this.candidateElementsMap.get(screenKey);
    if (mapped) {
      this.simulateClick(mapped);
      return await this.waitForScreenReady(screenKey, 3000);
    }

    // 3. Look for element with exact [data-screen="${screenKey}"]
    const directTarget = document.querySelector<HTMLElement>(`[data-screen="${screenKey}"]`);
    if (directTarget && this.isElementVisible(directTarget)) {
      this.simulateClick(directTarget);
      return await this.waitForScreenReady(screenKey, 3000);
    }

    // 4. Fallback: match text against tiles, modules, or tabs
    const normalizedTarget = normalizeArabicText(screenKey);
    const candidateEls = Array.from(document.querySelectorAll<HTMLElement>(
      '.dp-pgs__tile, .dp-pgs__mod, .dp-hdr__tab, [routerlink], .nav-link'
    ));
    for (const el of candidateEls) {
      const text = normalizeArabicText(el.textContent || '');
      if (text && (text === normalizedTarget || text.includes(normalizedTarget))) {
        this.simulateClick(el);
        return await this.waitForScreenReady(screenKey, 3000);
      }
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
            this.simulateClick(btn);
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
        this.simulateClick(el);
        await this.delay(300);
        return true;
      }
    }

    return false;
  }

  /**
   * Scans visible ERP screen items (tiles, modules, tabs, cards, chips) from the active DOM.
   * Dynamically inspects DynamicPro ERP DOM hierarchy and extracts rich contextual paths.
   */
  scanVisibleCandidates(): NavCandidateIn[] {
    this.candidateElementsMap.clear();
    const candidates: NavCandidateIn[] = [];
    const seenLabels = new Set<string>();

    if (typeof document === 'undefined') {
      return candidates;
    }

    const badContainers = '.dp-set, #dpSettingsLabel, lms-ai-copilot, app-copilot-chat';
    const domSelectors = [
      '.dp-pgs__tile',
      '.dp-pgs__mod',
      '.dp-hdr__tab',
      '.dp-mods__card',
      '.dp-cats__chip',
      '.screen-btn',
      '[data-screen]',
      'app-menu-master-category-selector button',
      'app-fast-screen button'
    ].join(', ');

    const elements = Array.from(document.querySelectorAll<HTMLElement>(domSelectors));

    // Detect currently active module name for hierarchical path context
    const activeModEl = document.querySelector<HTMLElement>('.dp-pgs__mod.is-active .dp-pgs__mod-name, .dp-pgs__mod.is-active');
    const activeModuleName = (activeModEl?.textContent || '').trim() || 'الرئيسية';

    let index = 1;
    for (const el of elements) {
      if (el.closest(badContainers)) continue;
      if (!this.isElementVisible(el)) continue;

      // Extract clean label: prioritize inner label element if present, else sanitize textContent
      const labelSpan = el.querySelector<HTMLElement>(
        '.dp-pgs__tile-name, .dp-pgs__mod-name, .screen-label, .dp-mods__title, .dp-hdr__tabtxt, .dp-hdr__tab-name, .dp-cats__txt'
      );
      let rawText = (labelSpan?.textContent || el.textContent || '').trim();
      // Remove bracketed codes like [PURCHASE_INVOICE] from text for cleaner matching
      rawText = rawText.replace(/\[.*?\]/g, '').trim();

      if (!rawText || rawText.length < 2 || rawText.length > 150) continue;

      const normalized = normalizeArabicText(rawText);
      if (seenLabels.has(normalized)) continue;
      seenLabels.add(normalized);

      const candidateId = el.getAttribute('data-screen') || el.id || `candidate_${index++}`;
      this.candidateElementsMap.set(candidateId, el);

      // Determine contextual hierarchical path for AI reasoning
      const path: string[] = [];
      if (el.classList.contains('dp-pgs__tile')) {
        path.push(activeModuleName);
        // Look for preceding group head inside page
        const cell = el.closest('.dp-pgs__cell');
        const prevGroup = cell?.previousElementSibling?.querySelector('.dp-grouphead__name') ||
                          el.closest('[class*="group"]')?.querySelector('.dp-grouphead__name');
        if (prevGroup && prevGroup.textContent) {
          path.push(prevGroup.textContent.trim());
        }
      } else if (el.classList.contains('dp-pgs__mod')) {
        path.push('الوحدات والبرامج الرئيسية');
      } else if (el.classList.contains('dp-hdr__tab')) {
        path.push('التبويبات المفتوحة');
      } else {
        path.push(activeModuleName);
      }

      candidates.push({
        id: candidateId,
        label: rawText,
        path
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
          detail: { screenKey: top.id, label: top.label }
        }));
        const targetEl = this.candidateElementsMap.get(top.id);

        if (targetEl) {
          this.simulateClick(targetEl);
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

