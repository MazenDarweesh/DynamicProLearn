import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NavCandidateIn, NavResolution, NavScored } from '../models/erp-form.models';
import { normalizeArabicText } from './erp-form-driver.service';
import { CopilotService } from './copilot.service';

@Injectable({
  providedIn: 'root'
})
export class ErpNavigatorService {
  private copilotService = inject(CopilotService, { optional: true });
  private candidateElementsMap = new Map<string, HTMLElement>();

  /**
   * Screen dictionary mapping keys to common Arabic labels and selectors
   */
  /**
   * Screen dictionary mapping keys to common Arabic labels and selectors
   */
  private readonly screenRegistry: Record<string, { labels: string[]; selectorHint?: string }> = {
    'PURCHASE_INVOICE': {
      labels: ['فاتورة المشتريات', 'الموردين و المشتريات', 'المشتريات'],
      selectorHint: 'select[name="Supplier"]'
    },
    'SALES_INVOICE': {
      labels: ['فاتورة المبيعات', 'العملاء  و المبيعات', 'المبيعات'],
      selectorHint: 'input[name="InvoiceNumber"]'
    },
    'NEW_CUSTOMER': {
      labels: ['تسجيل عميل جديد', 'العملاء والحسابات', 'عميل جديد'],
      selectorHint: 'input[name="CustomerName"]'
    },
    'JOURNAL_ENTRY': {
      labels: ['قيود اليومية العامة', 'الحسابات العامة', 'قيود اليومية'],
      selectorHint: 'input[name="EntryNumber"]'
    },
    'INVENTORY_AUDIT': {
      labels: ['الجرد والتسويات المخزنية', 'إدارة المستودعات', 'محضر الجرد'],
      selectorHint: 'input[name="AuditNumber"]'
    }
  };

  /**
   * Detects if the specified screen is currently active in the DOM.
   */
  isScreenActive(screenKey: string): boolean {
    const config = this.screenRegistry[screenKey];
    if (!config) return false;

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

    // 3. Check specific inputs that only exist when this specific screen is open
    if (config.selectorHint) {
      const el = document.querySelector(config.selectorHint);
      if (el && this.isElementVisible(el)) {
        return true;
      }
    }

    // 4. Check active screen tag in ERP card header
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

    const config = this.screenRegistry[screenKey] || { labels: [screenKey] };

    // 1. Dispatch custom event first so host / mock listeners switch screen immediately
    window.dispatchEvent(new CustomEvent('lms:navigate', {
      bubbles: true,
      composed: true,
      detail: { screenKey }
    }));

    // 2. Check for dedicated mock screen buttons
    const mockButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.screen-btn'));
    for (const btn of mockButtons) {
      const btnKey = btn.getAttribute('data-screen');
      const text = btn.textContent || '';
      if (btnKey === screenKey || config.labels.some(l => text.includes(l))) {
        btn.click();
        return await this.waitForScreenReady(screenKey, 3000);
      }
    }

    // 3. Check for real ERP Shell Navigation Cards (.dp-mods__card)
    const moduleCards = Array.from(document.querySelectorAll<HTMLElement>('.dp-mods__card, .dp-hdr__tab, .dp-cats__chip'));
    for (const card of moduleCards) {
      const cardKey = card.getAttribute('data-screen');
      const text = card.textContent || '';
      if (cardKey === screenKey || config.labels.some(l => text.includes(l))) {
        card.click();
        await this.delay(400);

        if (this.isScreenActive(screenKey)) {
          return true;
        }
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
   * Helper: Click the "New Document / Clear Form" button if present on the screen
   * to ensure a clean slate before filling each batch item.
   * Scoped strictly to the active form / card container to avoid accidental clicks on navigation tabs.
   */
  async prepareFreshForm(): Promise<boolean> {
    // 1. Target form card action containers first
    const actionContainers = Array.from(document.querySelectorAll<HTMLElement>(
      '.header-actions, .card-header, .erp-card, .dp-form-actions, [role="main"]'
    ));

    const candidateButtons: HTMLButtonElement[] = [];

    if (actionContainers.length > 0) {
      for (const container of actionContainers) {
        const btns = Array.from(container.querySelectorAll<HTMLButtonElement>('button, a'));
        for (const btn of btns) {
          if (!btn.closest('.screen-tabs, .erp-nav-bar, nav, header, .dp-hdr, aside, lms-ai-copilot, app-copilot-chat')) {
            candidateButtons.push(btn);
          }
        }
      }
    } else {
      const allBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('button, a'));
      for (const btn of allBtns) {
        if (!btn.closest('.screen-tabs, .erp-nav-bar, nav, header, .dp-hdr, aside, lms-ai-copilot, app-copilot-chat')) {
          candidateButtons.push(btn);
        }
      }
    }

    // 2. Strict matching on intent (avoid matching general words like 'تسجيل عميل جديد')
    for (const btn of candidateButtons) {
      const title = (btn.getAttribute('title') || '').trim();
      const text = (btn.textContent || '').trim();

      const isExactNewOrClear =
        title === 'جديد' ||
        title === 'فاتورة جديدة' ||
        title === 'تفريغ' ||
        text === 'جديد' ||
        text === 'تفريغ' ||
        text.includes('جديد / تفريغ') ||
        text.includes('جديد/تفريغ') ||
        text === '✨ جديد / تفريغ' ||
        btn.classList.contains('dp-btn--new');

      if (isExactNewOrClear) {
        btn.click();
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

    // Fallback: If on an empty/detached screen or mock buttons not in DOM, populate from registry
    if (candidates.length === 0) {
      for (const [key, val] of Object.entries(this.screenRegistry)) {
        candidates.push({
          id: key,
          label: val.labels[0] || key,
          path: ['الرئيسية']
        });
      }
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
  }> {
    const candidates = this.scanVisibleCandidates();
    if (candidates.length === 0) {
      return { success: false, decision: 'clarify', message: 'لم يتم العثور على أي شاشات متاحة في واجهة النظام حالياً.' };
    }

    if (!this.copilotService) {
      // Fallback if CopilotService not available
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
          // Try navigating by key/label in screenRegistry
          await this.navigateToScreen(top.id);
        }

        await this.delay(400);
        // Prepare fresh form if we reached the form/list
        await this.prepareFreshForm();

        return {
          success: true,
          decision: 'go',
          chosen: top
        };
      } else if (res.decision === 'ask') {
        return {
          success: false,
          decision: 'ask',
          askOptions: res.candidates.slice(0, 3)
        };
      } else {
        return {
          success: false,
          decision: 'clarify',
          message: 'يرجى توضيح اسم الشاشة أو العملية المطلوبة (مثال: فاتورة مشتريات، تسجيل عميل).'
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
