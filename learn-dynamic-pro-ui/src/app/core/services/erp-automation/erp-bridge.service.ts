import { Injectable, inject } from '@angular/core';
import {
  ErpActiveScreen,
  ErpScreenInfo,
  ErpSaveResult,
  ErpFormFillPayload,
  ErpActiveFormContext
} from '../../models/erp-bridge.models';
import { ErpTelemetryService } from './erp-telemetry.service';
import { observeSaveToastAndValidation } from './save-recovery/erp-save-verifier';

/**
 * Single safe access point to the host ERP's `window.DynamicERP` bridge.
 * Every method returns `null`/`false` when the bridge (or the call) is unavailable,
 * so callers can fall back to DOM-based logic. Failures are logged, never swallowed.
 */
@Injectable({
  providedIn: 'root'
})
export class ErpBridgeService {
  private telemetry = inject(ErpTelemetryService, { optional: true });

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.DynamicERP;
  }

  private lastActiveScreenCache: { time: number; val: ErpActiveScreen | null } | null = null;
  private lastFormContextCache: { time: number; val: ErpActiveFormContext | null } | null = null;

  getActiveScreen(forceRefresh = false): ErpActiveScreen | null {
    if (!this.isAvailable) return null;
    const now = Date.now();
    if (!forceRefresh && this.lastActiveScreenCache && (now - this.lastActiveScreenCache.time < 100)) {
      return this.lastActiveScreenCache.val;
    }
    try {
      const screen = window.DynamicERP!.getActiveScreen?.() ?? null;
      this.lastActiveScreenCache = { time: now, val: screen };
      this.telemetry?.logBridge('getActiveScreen', undefined, screen);
      if (screen?.pageName) {
        this.telemetry?.setScreenKey(screen.pageName);
      }
      return screen;
    } catch (err) {
      console.warn('[ErpBridge] getActiveScreen failed:', err);
      this.telemetry?.logBridge('getActiveScreen', undefined, null, err);
      return null;
    }
  }

  listScreens(): ErpScreenInfo[] | null {
    if (!this.isAvailable) return null;
    try {
      const bridge = window.DynamicERP as any;
      let screens: ErpScreenInfo[] | null = null;
      if (typeof bridge.listUserPages === 'function') screens = bridge.listUserPages() ?? null;
      else if (typeof bridge.listScreens === 'function') screens = bridge.listScreens() ?? null;
      else if (typeof bridge.getScreens === 'function') screens = bridge.getScreens() ?? null;
      else if (typeof bridge.getAuthorizedPages === 'function') screens = bridge.getAuthorizedPages() ?? null;
      else if (Array.isArray(bridge.screens)) screens = bridge.screens;
      else if (Array.isArray(bridge.pages)) screens = bridge.pages;

      this.telemetry?.logBridge('listScreens', undefined, { count: screens?.length ?? 0 });
      return screens;
    } catch (err) {
      console.warn('[ErpBridge] listScreens failed:', err);
      this.telemetry?.logBridge('listScreens', undefined, null, err);
      return null;
    }
  }

  /**
   * Checks if host ERP indicates active screen is busy with background HTTP requests or defer loading.
   */
  isPageBusy(): boolean {
    if (!this.isAvailable || typeof window.DynamicERP!.isPageBusy !== 'function') return false;
    try {
      const busy = !!window.DynamicERP!.isPageBusy();
      if (busy) {
        this.telemetry?.log('BRIDGE', 'DynamicERP.isPageBusy() -> true', undefined, 'DEBUG');
      }
      return busy;
    } catch {
      return false;
    }
  }

  /** Returns true if the bridge call completed without error and was not rejected by host. */
  async navigateToScreen(screenNameOrId: string | number): Promise<boolean> {
    const normalizedArg =
      typeof screenNameOrId === 'string' && /^\d+$/.test(screenNameOrId.trim())
        ? Number(screenNameOrId.trim())
        : screenNameOrId;

    const ok = await this.invoke(
      'navigateToScreen',
      () => window.DynamicERP!.navigateToScreen(normalizedArg),
      { screen: normalizedArg }
    );

    // Verify if we reached the target pageId; if not (e.g., shared pageName like "Sales Types" 225 vs 244),
    // fallback directly to Angular's app-base.pageService.addNewPage with the exact page object
    const activeAfter = this.getActiveScreen(true);
    const targetMatched =
      typeof normalizedArg === 'number'
        ? activeAfter?.pageId === normalizedArg
        : ok && !!activeAfter;

    if (targetMatched) {
      return true;
    }

    try {
      const ng = (window as any).ng;
      const appBaseEl = typeof document !== 'undefined' ? document.querySelector('app-base') : null;
      const baseComp = ng && appBaseEl ? ng.getComponent(appBaseEl) : null;
      const pageService = baseComp?.pageService;
      if (pageService && typeof pageService.addNewPage === 'function') {
        const screens = this.listScreens() || (Array.isArray(baseComp?.pages) ? baseComp.pages : []);
        const targetPage = screens.find((p: any) => {
          const pid = p.pageId ?? p.page_id ?? p.id;
          if (typeof normalizedArg === 'number') {
            return Number(pid) === normalizedArg;
          }
          const strArg = String(normalizedArg).trim().toLowerCase();
          return (
            String(pid).toLowerCase() === strArg ||
            String(p.title ?? p.name_ar ?? '').trim().toLowerCase() === strArg ||
            String(p.pageName ?? p.screen_key ?? '').trim().toLowerCase() === strArg
          );
        });
        if (targetPage) {
          pageService.addNewPage(targetPage);
          this.lastActiveScreenCache = null;
          this.telemetry?.log('BRIDGE', 'Navigated via Angular app-base.pageService.addNewPage fallback', {
            pageId: targetPage.pageId ?? targetPage.id,
            pageName: targetPage.pageName,
            title: targetPage.title
          });
          return true;
        }
      }
    } catch (err) {
      console.warn('[ErpBridge] Angular pageService.addNewPage fallback error:', err);
    }

    return ok;
  }

  /**
   * Returns true if the bridge found the action and opened the form.
   * If host returns `false` (e.g. button not found or already in form), returns `false` to trigger fallbacks.
   */
  async triggerAddNew(): Promise<boolean> {
    return this.invoke('triggerAddNew', () => window.DynamicERP!.triggerAddNew());
  }

  /**
   * Submits the active form and normalizes the response into a structured ErpSaveResult.
   * Automatically handles multi-option save menus (`span.dp-menu_text`) and captures
   * live validation toasts from `#toast-container.dp-toast-top-end`.
   */
  async submitActiveForm(): Promise<ErpSaveResult> {
    if (!this.isAvailable && typeof document === 'undefined') {
      this.telemetry?.logBridge('submitActiveForm', undefined, false, 'Bridge not available');
      return { success: false, errors: ['جسر الـ ERP غير متاح في هذه البيئة.'] };
    }

    const executePrimarySave = async (): Promise<ErpSaveResult> => {
      if (this.isAvailable && typeof (window.DynamicERP as any)?.submitActiveForm === 'function') {
        try {
          const raw = await window.DynamicERP!.submitActiveForm();
          if (raw && typeof raw === 'object') {
            const obj = raw as any;
            return {
              success: obj.success !== false,
              docId: obj.docId || obj.id,
              errors: Array.isArray(obj.errors) ? obj.errors : undefined,
              message: obj.message
            };
          }
          if (raw === false) {
            return { success: false, errors: ['فشل الحفظ في نظام الـ ERP.'] };
          }
          return { success: true };
        } catch (err: any) {
          console.warn('[ErpBridge] submitActiveForm threw error:', err);
          return {
            success: false,
            errors: [err?.message || 'حدث خطأ أثناء تنفيذ الحفظ في نظام الـ ERP.']
          };
        }
      }

      // 1. Try invoking save on the active Angular component instance in memory
      try {
        const comp = (window as any).DynamicERP?.getActiveComponentInstance?.();
        if (comp) {
          const saveMethod =
            typeof comp.save === 'function'
              ? 'save'
              : typeof comp.onSave === 'function'
                ? 'onSave'
                : null;
          if (saveMethod) {
            this.telemetry?.log(
              'BRIDGE',
              `submitActiveForm: Invoking activeComponent.${saveMethod}() in memory`,
              { method: saveMethod, compName: comp.constructor?.name },
              'INFO'
            );
            const res = await comp[saveMethod]();
            return {
              success: res !== false,
              docId: res?.docId || res?.id,
              message: 'تم إرسال أمر الحفظ عبر كائن المكون في الذاكرة.'
            };
          }
        }
      } catch (err: any) {
        this.telemetry?.log('BRIDGE', `activeComponent save invocation failed: ${err?.message}`, err, 'WARN');
      }

      // 2. Fallback to locating and clicking Save button in DOM (including split-button / dp-menu_text)
      const saveBtn = this.findSaveButtonInDom();
      if (saveBtn) {
        this.telemetry?.log(
          'BRIDGE',
          `submitActiveForm fallback: Clicked DOM Save button [${saveBtn.tagName.toLowerCase()}${saveBtn.className ? `.${saveBtn.className.slice(0, 30)}` : ''}]`,
          {
            buttonText: saveBtn.textContent?.trim(),
            buttonSelector: saveBtn.id ? `#${saveBtn.id}` : saveBtn.className,
            fallbackAttempted: 'DOM_SAVE_BUTTON'
          },
          'INFO'
        );
        saveBtn.click();
        return {
          success: true,
          message: 'تم إرسال أمر الحفظ عبر زر الشاشة بنجاح.'
        };
      }

      return {
        success: false,
        message: 'لم يتم العثور على زر الحفظ النشط في الشاشة الحالية.',
        errors: ['لم يتم العثور على زر الحفظ النشط في الشاشة الحالية.']
      };
    };

    const { actionResult, toasts, subMenuClicked } = await observeSaveToastAndValidation(
      executePrimarySave,
      950
    );

    const errorToasts = toasts.filter((t) => t.kind === 'error' || t.kind === 'warning');
    const successToasts = toasts.filter((t) => t.kind === 'success');

    let finalResult: ErpSaveResult = {
      ...actionResult,
      subMenuClicked
    };

    if (errorToasts.length > 0) {
      const toastTexts = errorToasts.map((t) => t.text);
      finalResult = {
        success: false,
        errors: toastTexts,
        message: toastTexts.join(' — '),
        subMenuClicked
      };
    } else if (successToasts.length > 0) {
      const topSuccess = successToasts[0];
      finalResult = {
        success: true,
        docId: actionResult.docId || topSuccess.docId,
        message: topSuccess.text || actionResult.message,
        subMenuClicked
      };
    }

    this.telemetry?.logBridge('submitActiveForm', { subMenuClicked, toastsCount: toasts.length }, finalResult);
    return finalResult;
  }

  /**
   * Helper to locate the primary Save button in the active form root or toolbar.
   */
  findSaveButtonInDom(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const selectors = [
      'button.dp-btn--save',
      'button[title*="حفظ" i]',
      'button[aria-label*="حفظ" i]',
      'button.btn-save',
      '[data-action="save"]',
      '.dp-form-actions button.btn-primary',
      '.actions-bar button.btn-primary'
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel) as HTMLElement;
      if (btn && btn.offsetWidth > 0 && btn.offsetHeight > 0 && !btn.hasAttribute('disabled')) {
        return btn;
      }
    }

    // Check if `<span class="dp-menu_text">حفظ</span>` is already visible in DOM
    const menuSpans = Array.from(
      document.querySelectorAll<HTMLElement>('span.dp-menu_text, span.dp-menu__text')
    );
    for (const sp of menuSpans) {
      if (sp.closest('lms-ai-copilot, app-copilot-chat')) continue;
      const text = (sp.textContent || '').trim();
      if ((text === 'حفظ' || text.startsWith('حفظ')) && sp.offsetWidth > 0 && sp.offsetHeight > 0) {
        return (sp.closest('button, li, a, [role="menuitem"]') as HTMLElement) || sp;
      }
    }

    const allButtons = Array.from(document.querySelectorAll('button, a.btn, [role="button"]')) as HTMLElement[];
    for (const btn of allButtons) {
      if (btn.closest('lms-ai-copilot, app-copilot-chat')) continue;
      if (btn.offsetWidth > 0 && btn.offsetHeight > 0 && !btn.hasAttribute('disabled')) {
        const text = (btn.textContent || '').trim();
        if (text === 'حفظ' || text.includes('حفظ المستند') || text.includes('حفظ الفاتورة')) {
          return btn;
        }
      }
    }
    return null;
  }

  /**
   * Directly populates form state and grid rows via the official host ERP bridge.
   * Leverages in-memory binding (excelObject / dataObject) without fragile DOM scraping.
   */
  async fillFormData(payload: ErpFormFillPayload): Promise<boolean> {
    if (!this.isAvailable || typeof window.DynamicERP!.fillFormData !== 'function') {
      return false;
    }
    return this.invoke('fillFormData', () => window.DynamicERP!.fillFormData!(payload), {
      fieldsCount: Object.keys(payload.fields || {}).length,
      rowsCount: payload.rows?.length || 0
    });
  }

  /**
   * Directly checks if the host ERP indicates an active transaction or document form is currently open.
   */
  getActiveFormContext(forceRefresh = false): ErpActiveFormContext | null {
    if (!this.isAvailable || typeof window.DynamicERP!.getActiveFormContext !== 'function') {
      return null;
    }
    const now = Date.now();
    if (!forceRefresh && this.lastFormContextCache && (now - this.lastFormContextCache.time < 100)) {
      return this.lastFormContextCache.val;
    }
    try {
      const ctx = window.DynamicERP!.getActiveFormContext() || null;
      this.lastFormContextCache = { time: now, val: ctx };
      this.telemetry?.logBridge('getActiveFormContext', undefined, ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  private async invoke(name: string, call: () => unknown, args?: any): Promise<boolean> {
    if (!this.isAvailable) {
      this.telemetry?.logBridge(name, args, false, 'Bridge not available');
      return false;
    }
    try {
      const res = await call();
      if (res === false) {
        console.warn(`[ErpBridge] ${name} returned false from host.`);
        this.telemetry?.logBridge(name, args, false);
        return false;
      }
      this.telemetry?.logBridge(name, args, true);
      return true;
    } catch (err) {
      console.warn(`[ErpBridge] ${name} failed:`, err);
      this.telemetry?.logBridge(name, args, false, err);
      return false;
    }
  }
}
