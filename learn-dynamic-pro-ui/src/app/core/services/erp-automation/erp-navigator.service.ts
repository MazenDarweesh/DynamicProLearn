import { Injectable, inject, Injector } from '@angular/core';
import { NavCandidateIn, NavResolution, NavScored, ControlIn } from '../../models/erp-form.models';
import { normalizeArabicText } from './form-driver/arabic-normalizer';
import { CopilotService } from '../ai-copilot/copilot.service';
import { ErpBridgeService } from './erp-bridge.service';

@Injectable({
  providedIn: 'root'
})
export class ErpNavigatorService {
  private injector = inject(Injector);
  private bridge = inject(ErpBridgeService);
  private candidateElementsMap = new Map<string, HTMLElement>();

  private get copilotService(): CopilotService | null {
    try {
      return this.injector.get(CopilotService, null);
    } catch {
      return null;
    }
  }

  /**
   * Detects if the specified screen is currently active in the DOM.
   * Completely dynamic: checks screen attributes, tabs, and page headers without hardcoded dictionaries.
   */
  isScreenActive(screenKey: string): boolean {
    if (!screenKey) return false;
    const normalizedKey = normalizeArabicText(screenKey);
    const upperKey = screenKey.toUpperCase().trim();

    // 0. Official ERP bridge (authoritative positive match)
    const active = this.bridge.getActiveScreen();
    if (active) {
      if (active.pageName && (
        normalizeArabicText(active.pageName) === normalizedKey ||
        active.pageName.toUpperCase().trim() === upperKey
      )) {
        return true;
      }
      if (active.title && (
        normalizeArabicText(active.title) === normalizedKey ||
        active.title.toUpperCase().trim() === upperKey
      )) {
        return true;
      }
      const screens = this.bridge.listScreens();
      if (screens && (active.pageName || active.screenKey)) {
        const matchedTarget = screens.find(s =>
          (s.pageName && s.pageName.toUpperCase().trim() === upperKey) ||
          (s.title && normalizeArabicText(s.title) === normalizedKey) ||
          String(s.pageId) === screenKey
        );
        if (matchedTarget) {
          if (active.pageName && matchedTarget.pageName?.toUpperCase().trim() === active.pageName.toUpperCase().trim()) {
            return true;
          }
          if (active.screenKey && (matchedTarget.screenKey === active.screenKey || matchedTarget.pageName === active.screenKey)) {
            return true;
          }
          if (matchedTarget.pageId === active.pageId && active.pageName) {
            return true;
          }
        }
      }
    }

    // 1. Check active tab or button with .active / .is-active specifically for this screenKey
    const activeTab = document.querySelector(
      `.screen-btn.active[data-screen="${screenKey}"], .screen-btn.active[data-screen="${upperKey}"], .dp-hdr__tab.is-active[data-screen="${screenKey}"], .dp-mods__card.is-active[data-screen="${screenKey}"], .dp-pgs__mod.is-active[data-screen="${screenKey}"]`
    );
    if (activeTab && this.isElementVisible(activeTab)) {
      return true;
    }

    // 2. Check active header tab text
    const activeHdrTabs = Array.from(document.querySelectorAll<HTMLElement>(
      '.dp-hdr__tab.is-active .dp-hdr__tab-name, .dp-hdr__tab.is-active, .dp-hdr__trig-label'
    ));
    for (const tab of activeHdrTabs) {
      const text = normalizeArabicText(tab.textContent || '');
      if (text && (text === normalizedKey || text.includes(normalizedKey) || normalizedKey.includes(text))) {
        return true;
      }
    }

    // 3. Check active module text
    const activeMods = Array.from(document.querySelectorAll<HTMLElement>(
      '.dp-pgs__mod.is-active .dp-pgs__mod-name, .dp-pgs__mod.is-active'
    ));
    for (const mod of activeMods) {
      const text = normalizeArabicText(mod.textContent || '');
      if (text && (text === normalizedKey || text.includes(normalizedKey))) {
        return true;
      }
    }

    // 4. Check if the active form content matches this screenKey
    const formContent = document.querySelector(
      `[data-screen-content="${screenKey}"], [data-screen-content="${upperKey}"]`
    );
    if (formContent && this.isElementVisible(formContent)) {
      return true;
    }

    // 5. Check active screen tag in ERP card header or main page title (h1, h2, code)
    const activeHeaders = Array.from(document.querySelectorAll<HTMLElement>(
      '.card-header h2, .erp-card h2, .screen-tag code, .page-title, h1, h2, .dp-hdr__title'
    ));
    for (const hdr of activeHeaders) {
      const text = normalizeArabicText(hdr.textContent || '');
      const rawText = (hdr.textContent || '').toUpperCase().trim();
      if (text === normalizedKey || rawText === upperKey || text.includes(normalizedKey)) {
        return true;
      }
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

    // Priority 1: official ERP bridge
    if (await this.bridge.navigateToScreen(screenKey)) {
      if (await this.waitForScreenReady(screenKey, 2500)) {
        return true;
      }
      console.warn('[ErpNavigator] Bridge navigation did not reach target, falling back to DOM:', screenKey);
    }

    // 1. Dispatch custom events so host / mock listeners switch screen immediately
    window.dispatchEvent(new CustomEvent('lms:navigate', {
      bubbles: true,
      composed: true,
      detail: { screenKey }
    }));
    window.dispatchEvent(new CustomEvent('window:lms:navigate', {
      bubbles: true,
      composed: true,
      detail: { screenName: screenKey }
    }));

    // 2. Candidate map lookup
    const mapped = this.candidateElementsMap.get(screenKey);
    if (mapped) {
      this.simulateClick(mapped);
      return await this.waitForScreenReady(screenKey, 2500);
    }

    // 3. Look for element with exact [data-screen="${screenKey}"]
    const directTarget = document.querySelector<HTMLElement>(`[data-screen="${screenKey}"], [data-screen="${screenKey.toUpperCase().trim()}"]`);
    if (directTarget && this.isElementVisible(directTarget)) {
      this.simulateClick(directTarget);
      return await this.waitForScreenReady(screenKey, 2500);
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
        return await this.waitForScreenReady(screenKey, 2500);
      }
    }

    return await this.waitForScreenReady(screenKey, 1500);
  }

  /**
   * Waits for target screen DOM elements to become visible AND fully loaded.
   * Handles slow ERP screens, background network requests, and @defer component rendering.
   */
  async waitForScreenReady(screenKey: string, timeoutMs = 2500): Promise<boolean> {
    const startTime = Date.now();
    let tabActivated = false;

    while (Date.now() - startTime < timeoutMs) {
      if (this.isScreenActive(screenKey)) {
        tabActivated = true;
        if (this.isScreenContentLoaded()) {
          return true;
        }
      }
      await this.delay(50);
    }
    return tabActivated;
  }

  /**
   * Checks whether the active screen content has rendered its primary container
   * and is not currently blocked by a busy state or loading spinner.
   */
  isScreenContentLoaded(): boolean {
    if (typeof document === 'undefined') return true;

    if (this.bridge.isPageBusy()) {
      return false;
    }

    const activeContainer =
      (document.querySelector('.dp-shell__pages > div:not([hidden])') as HTMLElement) ||
      (document.querySelector('[role="main"]') as HTMLElement) ||
      document.body;

    const spinner = activeContainer.querySelector(
      '.dp-spinner, .loading-spinner, .dp-busy, .spinner-border, [role="progressbar"], .mat-progress-spinner, app-loading'
    );
    if (spinner && this.isElementVisible(spinner)) {
      return false;
    }

    const hasCoreComponent = activeContainer.querySelector(
      '#dpGrid, app-master-list, .dp-table, .dp-list__act, button.dp-btn--primary, app-add-or-edit, .dp-form, input, select'
    );

    return !!hasCoreComponent;
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
      const cleanLabel = (text || el.getAttribute('title') || id).slice(0, 80).trim();
      if (!cleanLabel) continue;

      controls.push({
        id,
        label: cleanLabel
      });
      elementMap.set(id, el);
    }
    return { controls, elementMap };
  }

  /**
   * Clicks the "New Document / اضافة جديد" button on the screen or master list
   * to open the creation form before filling data.
   */
  async prepareFreshForm(maxWaitMs = 2500): Promise<boolean> {
    if (this.isFormAlreadyOpen()) {
      return true;
    }

    const start = Date.now();

    if (this.bridge.isAvailable) {
      try {
        const opened = await this.bridge.triggerAddNew();
        if (opened) {
          const ready = await this.waitForFormContainer(1200);
          if (ready) return true;
        }
      } catch (err) {
        console.warn('[ErpNavigator] bridge.triggerAddNew error:', err);
      }
    }

    while (Date.now() - start < maxWaitMs) {
      if (this.isFormAlreadyOpen()) return true;
      const clicked = this.triggerDomAddNew();
      if (clicked) {
        const ready = await this.waitForFormContainer(1500);
        if (ready) return true;
      }
      await this.delay(100);
    }

    return this.isFormAlreadyOpen();
  }

  /**
   * Checks whether an AddOrEdit form container, modal, transactional document editor, or mock form is currently open.
   */
  isFormAlreadyOpen(): boolean {
    const ctx = this.bridge.getActiveFormContext();
    if (ctx) {
      if (ctx.dataObject || (ctx.rows && ctx.rows.length >= 0 && ctx.formType !== 'dom') || ctx.isInvoice) {
        return true;
      }
    }

    if (typeof document === 'undefined') return false;

    const modalForm = document.querySelector(
      '.cdk-overlay-container .dp-modal app-add-or-edit, ' +
      '.cdk-overlay-container .dp-modal, ' +
      '#addOrEditPopUp'
    );
    if (modalForm && this.isElementVisible(modalForm)) {
      return true;
    }

    const activePage = document.querySelector('.dp-shell__pages > div:not([hidden])') || document;
    const pageForm = activePage.querySelector('app-add-or-edit, .dp-edit, .dp-list__pre, .dp-edit__head, section.dp-pu__sup');
    if (pageForm && this.isElementVisible(pageForm)) {
      return true;
    }

    const primaryInput = activePage.querySelector<HTMLElement>(
      'ng-select[formcontrolname], [formcontrolname="SupplierID"], [formcontrolname="CustomerID"], [formcontrolname="StoreID"], [formcontrolname="EmpId"], input#productQty'
    );
    if (primaryInput && this.isElementVisible(primaryInput)) {
      return true;
    }

    return false;
  }

  /**
   * Waits for the AddOrEdit form container to appear in the DOM with fast responsive polling.
   */
  async waitForFormContainer(timeoutMs = 1200): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.isFormAlreadyOpen()) {
        return true;
      }
      await this.delay(50);
    }
    return this.isFormAlreadyOpen();
  }

  /**
   * Attempts to locate and click the Add New button via DOM selectors and text matching.
   */
  private triggerDomAddNew(): boolean {
    if (typeof document === 'undefined') return false;

    const masterAddBtn = document.querySelector<HTMLElement>(
      'button.dp-btn--primary.dp-list__act, .dp-list__act.dp-btn--primary, button.dp-btn--new, [data-action="new"], button.dp-list__act'
    );
    const targetAddBtn = masterAddBtn?.closest('button') || masterAddBtn;
    if (targetAddBtn && this.isElementVisible(targetAddBtn)) {
      console.info('%c[ErpNavigator] Triggered "اضافة جديد" on Master List:', 'color:#10b981;font-weight:bold', targetAddBtn);
      this.simulateClick(targetAddBtn);
      return true;
    }

    const allButtons = Array.from(document.querySelectorAll<HTMLElement>(
      'app-master-list button, .dp-list__actions button, .header-actions button, .dp-shell__pages button, button'
    ));
    for (const btn of allButtons) {
      if (btn.closest('lms-ai-copilot, app-copilot-chat, nav, .dp-hdr')) continue;
      if (!this.isElementVisible(btn)) continue;
      const text = normalizeArabicText(btn.textContent || '').trim();
      const hasPlusIcon = !!btn.querySelector('.fa-plus, .bi-plus, i[class*="plus"]');
      if (
        text === 'اضافة جديد' ||
        text === 'اضافه جديد' ||
        text === 'جديد' ||
        text === 'اضافة' ||
        text === 'اضافه' ||
        text === 'add new' ||
        (hasPlusIcon && (text.includes('اضاف') || text.includes('جديد') || text === ''))
      ) {
        console.info('%c[ErpNavigator] Triggered Add New by text/icon match:', 'color:#10b981;font-weight:bold', text || 'plus-icon');
        this.simulateClick(btn);
        return true;
      }
    }
    return false;
  }

  /**
   * Scans visible ERP screen items (tiles, modules, tabs, cards, chips) from the active DOM.
   */
  scanVisibleCandidates(): NavCandidateIn[] {
    this.candidateElementsMap.clear();
    const candidates: NavCandidateIn[] = [];
    const seenLabels = new Set<string>();

    if (typeof document === 'undefined') {
      return candidates;
    }

    const catalog = this.bridge.listScreens();
    if (catalog && catalog.length > 0) {
      return catalog.map((s: any) => {
        const pid = s.page_id ?? s.pageId;
        const key = String(s.screen_key ?? s.pageName ?? (pid ? String(pid) : 'screen')).trim();
        const titleAr = String(s.name_ar ?? s.title ?? s.pageName ?? key).trim();
        const mod = String(s.moduleName ?? s.module ?? '').trim();
        return {
          id: String(pid || key),
          label: titleAr || key,
          path: mod ? [mod] : []
        };
      });
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

    const activeModEl = document.querySelector<HTMLElement>('.dp-pgs__mod.is-active .dp-pgs__mod-name, .dp-pgs__mod.is-active');
    const activeModuleName = (activeModEl?.textContent || '').trim() || 'الرئيسية';

    let index = 1;
    for (const el of elements) {
      if (el.closest(badContainers)) continue;
      if (!this.isElementVisible(el)) continue;

      const labelSpan = el.querySelector<HTMLElement>(
        '.dp-pgs__tile-name, .dp-pgs__mod-name, .screen-label, .dp-mods__title, .dp-hdr__tabtxt, .dp-hdr__tab-name, .dp-cats__txt'
      );
      let rawText = (labelSpan?.textContent || el.textContent || '').trim();
      rawText = rawText.replace(/\[.*?\]/g, '').trim();

      if (!rawText || rawText.length < 2 || rawText.length > 150) continue;

      const normalized = normalizeArabicText(rawText);
      if (seenLabels.has(normalized)) continue;
      seenLabels.add(normalized);

      const candidateId =
        el.getAttribute('data-screen') ||
        el.getAttribute('data-page-name') ||
        el.getAttribute('data-page') ||
        el.getAttribute('data-page-id') ||
        el.getAttribute('pageName') ||
        (el.id && !el.id.startsWith('candidate_') ? el.id : undefined) ||
        `candidate_${index++}`;
      this.candidateElementsMap.set(candidateId, el);

      const path: string[] = [];
      if (el.classList.contains('dp-pgs__tile')) {
        path.push(activeModuleName);
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
      const activeScreenName = this.bridge.getActiveScreen()?.pageName;
      const currentPath = activeScreenName ? [activeScreenName.trim()] : [];
      const res = await this.copilotService.resolveErpNavigation({
        user_message: userMessage,
        candidates,
        current_path: currentPath
      });
      console.info('%c[ErpNavigator] resolve response from backend:', 'color:#8b5cf6;font-weight:bold', res);

      if (res.decision === 'go' && res.candidates.length > 0) {
        const top = res.candidates[0];

        if (activeScreenName && this.isScreenActive(top.id)) {
          console.info('%c[ErpNavigator] Already on target screen:', 'color:#10b981;font-weight:bold', top.id);
          return {
            success: true,
            decision: 'go',
            chosen: top,
            rawResolution: res
          };
        }

        const activeNorm = (activeScreenName || '').trim().toLowerCase();
        const topIdNorm = top.id.trim().toLowerCase();
        const isDetailScreen =
          topIdNorm.includes('detail') ||
          topIdNorm.includes('تفاصيل') ||
          topIdNorm.includes('report') ||
          topIdNorm.includes('تقرير') ||
          topIdNorm.includes('total') ||
          topIdNorm.includes('اجمالي') ||
          topIdNorm.includes('إجمالي') ||
          topIdNorm.includes('ارصدة') ||
          topIdNorm.includes('أرصدة');
        const isSameDomain =
          (activeNorm.includes('purchas') && topIdNorm.includes('purchas')) ||
          (activeNorm.includes('sale') && topIdNorm.includes('sale')) ||
          (activeNorm.includes('entry') && topIdNorm.includes('entry'));

        if (isSameDomain && isDetailScreen) {
          console.info(`%c[ErpNavigator] Downgrade prevented: Already on primary screen '${activeScreenName}', refusing to switch to detail screen '${top.id}'`, 'color:#10b981;font-weight:bold');
          return {
            success: true,
            decision: 'go',
            chosen: { id: activeScreenName || top.id, confidence: 1.0, reason: 'Retained primary transactional screen' },
            rawResolution: res
          };
        }

        const targetEl = this.candidateElementsMap.get(top.id);

        const realScreenName =
          targetEl?.getAttribute('data-screen') ||
          targetEl?.getAttribute('data-page-name') ||
          targetEl?.getAttribute('data-page') ||
          targetEl?.getAttribute('pageName') ||
          (!top.id.startsWith('candidate_') ? top.id : undefined);

        if (targetEl) {
          this.simulateClick(targetEl);
          await this.delay(400);
        } else if (realScreenName) {
          await this.navigateToScreen(realScreenName);
        }

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
