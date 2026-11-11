import { Injectable, inject } from '@angular/core';
import {
  ErpActiveScreen,
  ErpScreenInfo,
  ErpSaveResult,
  ErpFormFillPayload,
  ErpActiveFormContext,
  ErpFormStateSnapshot,
  ErpBridgeCapabilities,
  ErpLookupFieldSpec,
  ErpLookupOption,
  StrictLookupFetchResult,
  ErpSelectLookupResult,
  ErpTableRowPayload,
  ErpClearTableRowsResult,
  ErpAddTableRowResult,
  ErpSaveDocumentOptions,
  ErpSaveDocumentResult
} from '../../models/erp-bridge.models';
import { ErpTelemetryService } from './erp-telemetry.service';
import {
  CapturedSaveToast,
  findOpenSaveMenuItem,
  isSaveMenuStillOpen,
  observeSaveToastAndValidation,
  readVisibleSaveToasts,
  SAVE_TRIGGER_SELECTOR,
  triggerFullClick
} from './save-recovery/erp-save-verifier';

const REQUIRED_V250_METHODS = [
  'fetchLookupData',
  'clearTableRows',
  'selectLookup',
  'addTableRow',
  'saveDocument'
] as const;

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  hasPrerelease: boolean;
}

function parseSemver(raw: unknown): ParsedSemver | null {
  if (typeof raw !== 'string') return null;
  const match = raw.trim().match(/^[vV]?(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: match[3] !== undefined ? Number(match[3]) : 0,
    hasPrerelease: !!match[4]
  };
}

/**
 * Pure semver check for v2.5.0 capability gating (`contractVersion >= minVersion`).
 * Rejects pre-release builds matching the exact minimum tuple (e.g. `2.5.0-rc1 < 2.5.0`).
 */
export function isContractVersionAtLeast(contractVersion: unknown, minVersion = '2.5.0'): boolean {
  const actual = parseSemver(contractVersion);
  const minimum = parseSemver(minVersion);
  if (!actual || !minimum) return false;
  if (actual.major !== minimum.major) return actual.major > minimum.major;
  if (actual.minor !== minimum.minor) return actual.minor > minimum.minor;
  if (actual.patch !== minimum.patch) return actual.patch > minimum.patch;
  return !actual.hasPrerelease || minimum.hasPrerelease;
}

function isNonEmptyIdValue(value: unknown): value is string | number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== '0';
  }
  return false;
}

function isNonEmptyTextValue(value: unknown): boolean {
  if (value === undefined || value === null || typeof value === 'object') return false;
  return String(value).trim().length > 0;
}

/**
 * Strictly validates each row for exact own properties `valueKey` and `textKey`
 * without heuristic fallback keys (`id`, `name`, `label`, etc.).
 */
export function validateAndMapLookupRows(
  rows: unknown[],
  valueKey: string,
  textKey: string
): { options: ErpLookupOption[]; invalidRows: number; sampleMissingKeys: string[] } {
  const options: ErpLookupOption[] = [];
  let invalidRows = 0;
  const missingSet = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      invalidRows++;
      missingSet.add(valueKey);
      missingSet.add(textKey);
      continue;
    }

    const record = row as Record<string, unknown>;
    const hasValueKey =
      Object.prototype.hasOwnProperty.call(record, valueKey) && isNonEmptyIdValue(record[valueKey]);
    const hasTextKey =
      Object.prototype.hasOwnProperty.call(record, textKey) && isNonEmptyTextValue(record[textKey]);

    if (!hasValueKey || !hasTextKey) {
      invalidRows++;
      if (!hasValueKey) missingSet.add(valueKey);
      if (!hasTextKey) missingSet.add(textKey);
      continue;
    }

    const rawId = record[valueKey] as string | number;
    options.push({
      id: typeof rawId === 'number' ? rawId : rawId.trim(),
      label: String(record[textKey]).trim(),
      raw: record
    });
  }

  return { options, invalidRows, sampleMissingKeys: Array.from(missingSet) };
}

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
  private lastFormStateCache: { time: number; val: ErpFormStateSnapshot | null } | null = null;
  /** Last logged signatures — polling loops must not flood the session log with identical entries. */
  private lastLoggedScreenSig = '';
  private lastLoggedFormCtxSig = '';

  getActiveScreen(forceRefresh = false): ErpActiveScreen | null {
    if (!this.isAvailable) return null;
    const now = Date.now();
    if (!forceRefresh && this.lastActiveScreenCache && (now - this.lastActiveScreenCache.time < 100)) {
      return this.lastActiveScreenCache.val;
    }
    try {
      const screen = window.DynamicERP!.getActiveScreen?.() ?? null;
      this.lastActiveScreenCache = { time: now, val: screen };
      const sig = `${screen?.pageId ?? ''}|${screen?.pageName ?? ''}`;
      if (sig !== this.lastLoggedScreenSig) {
        this.lastLoggedScreenSig = sig;
        this.telemetry?.logBridge('getActiveScreen', undefined, screen);
      }
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
    this.invalidateFormCaches();
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
    this.invalidateFormCaches();
    const ok = await this.invoke('triggerAddNew', () => window.DynamicERP!.triggerAddNew());
    this.invalidateFormCaches();
    return ok;
  }

  private invalidateFormCaches(): void {
    this.lastFormContextCache = null;
    this.lastFormStateCache = null;
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

      // 2. Fallback to locating and clicking Save button in DOM (including split-button / dp-menu__text)
      const openMenuItem = findOpenSaveMenuItem('حفظ');
      if (openMenuItem) {
        this.telemetry?.log(
          'BRIDGE',
          'submitActiveForm: Save menu already open — clicking "حفظ" item directly',
          { target: openMenuItem.tagName, text: openMenuItem.textContent?.trim() },
          'INFO'
        );
        triggerFullClick(openMenuItem);
        return { success: true, message: 'تم الضغط مباشرة على خيار «حفظ» في القائمة المفتوحة.' };
      }

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

    const before = this.captureFormFingerprint();

    const { actionResult, toasts, subMenuClicked } = await observeSaveToastAndValidation(
      executePrimarySave,
      1800
    );

    let errorToasts = toasts.filter((t) => t.kind === 'error' || t.kind === 'warning');
    let successToasts = toasts.filter((t) => t.kind === 'success');

    let finalResult: ErpSaveResult;

    if (errorToasts.length > 0) {
      finalResult = this.buildFailedSave(errorToasts.map((t) => t.text), subMenuClicked);
    } else if (!actionResult.success) {
      // Bridge/host/DOM level failure (button not found, host threw, ...).
      finalResult = {
        ...actionResult,
        success: false,
        outcome: 'failed',
        subMenuClicked
      };
    } else if (successToasts.length > 0) {
      finalResult = {
        success: true,
        outcome: 'saved',
        docId: actionResult.docId || successToasts[0].docId,
        message: successToasts[0].text || actionResult.message,
        subMenuClicked
      };
    } else {
      // No toast yet: look for positive evidence (late toast, form closed/cleared) before claiming anything.
      const evidence = await this.waitForSaveEvidence(before, 2200);
      errorToasts = evidence.toasts.filter((t) => t.kind === 'error' || t.kind === 'warning');
      successToasts = evidence.toasts.filter((t) => t.kind === 'success');

      if (errorToasts.length > 0) {
        finalResult = this.buildFailedSave(errorToasts.map((t) => t.text), subMenuClicked);
      } else if (successToasts.length > 0 || evidence.formChanged) {
        finalResult = {
          success: true,
          outcome: 'saved',
          docId: actionResult.docId || successToasts[0]?.docId,
          message: successToasts[0]?.text || 'تم الحفظ (تأكيد من حالة الشاشة بعد الحفظ).',
          subMenuClicked
        };
      } else {
        const menuOpen = isSaveMenuStillOpen();
        finalResult = {
          success: false,
          outcome: 'unconfirmed',
          message: menuOpen
            ? 'لم يكتمل الحفظ: قائمة الحفظ ما زالت مفتوحة في الشاشة. اضغط «حفظ» من القائمة يدوياً.'
            : 'تم الضغط على الحفظ لكن لم أتمكن من تأكيد نجاحه. راجع الشاشة قبل المتابعة.',
          subMenuClicked
        };
      }
    }

    this.telemetry?.logBridge(
      'submitActiveForm',
      { subMenuClicked, toastsCount: toasts.length, outcome: finalResult.outcome, before },
      finalResult
    );
    this.invalidateFormCaches();
    return finalResult;
  }

  private buildFailedSave(texts: string[], subMenuClicked?: string): ErpSaveResult {
    return {
      success: false,
      outcome: 'failed',
      errors: texts,
      message: texts.join(' — '),
      subMenuClicked
    };
  }

  /**
   * Cheap fingerprint of the open document used to detect that a Save really consumed it
   * (rows with a resolved product, number of populated header values, form still open).
   */
  private captureFormFingerprint(): { isOpen: boolean; rowsWithProduct: number; dataKeys: number } {
    const ctx = this.getActiveFormContext(true);
    const rows = Array.isArray(ctx?.rows) ? ctx!.rows! : [];
    const rowsWithProduct = rows.filter((r: any) => r && (r.ProductID || r.ItemId)).length;
    const data = ctx?.dataObject || {};
    const dataKeys = Object.keys(data).filter((k) => data[k] != null && data[k] !== '').length;
    return { isOpen: !!ctx?.isOpen, rowsWithProduct, dataKeys };
  }

  /** Polls for late toasts / a closed-or-reset form after a Save click that produced no immediate toast. */
  private async waitForSaveEvidence(
    before: { isOpen: boolean; rowsWithProduct: number; dataKeys: number },
    maxWaitMs: number
  ): Promise<{ formChanged: boolean; toasts: CapturedSaveToast[] }> {
    const start = Date.now();
    let toasts: CapturedSaveToast[] = [];
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 250));
      toasts = readVisibleSaveToasts();
      if (toasts.length > 0) return { formChanged: false, toasts };

      const after = this.captureFormFingerprint();
      const closed = before.isOpen && !after.isOpen;
      const rowsCleared = before.rowsWithProduct > 0 && after.rowsWithProduct === 0;
      const headerReset = before.dataKeys >= 6 && before.dataKeys - after.dataKeys >= 4;
      if (closed || rowsCleared || headerReset) {
        return { formChanged: true, toasts };
      }
    }
    return { formChanged: false, toasts };
  }

  /**
   * Helper to locate the primary Save button in the active form root or toolbar.
   */
  findSaveButtonInDom(): HTMLElement | null {
    if (typeof document === 'undefined') return null;

    // Priority 1: Check if `<span class="dp-menu__text">حفظ</span>` is already visible in DOM (menu open)
    const openItem = findOpenSaveMenuItem('حفظ');
    if (openItem) {
      return openItem;
    }

    const menuSpans = Array.from(
      document.querySelectorAll<HTMLElement>('span.dp-menu__text, span.dp-menu_text')
    ).filter(
      (sp) =>
        !sp.closest('lms-ai-copilot, app-copilot-chat') &&
        !sp.closest(SAVE_TRIGGER_SELECTOR) &&
        !sp.matches(SAVE_TRIGGER_SELECTOR)
    );
    for (const sp of menuSpans) {
      const text = (sp.textContent || '').trim();
      if ((text === 'حفظ' || text.startsWith('حفظ')) && sp.offsetWidth > 0 && sp.offsetHeight > 0) {
        return (sp.closest('button, li, a, [role="menuitem"], .dp-menu__item') as HTMLElement) || sp;
      }
    }

    // Priority 2: Primary trigger button (button.dp-edit__save)
    const selectors = [
      'button.dp-edit__save',
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
      const sig = ctx
        ? `${ctx.isOpen}|${ctx.screenName ?? ''}|${ctx.formType ?? ''}|${ctx.dataObject ? Object.keys(ctx.dataObject).length : -1}|${ctx.rows ? ctx.rows.length : -1}`
        : 'null';
      if (sig !== this.lastLoggedFormCtxSig) {
        this.lastLoggedFormCtxSig = sig;
        this.telemetry?.logBridge('getActiveFormContext', undefined, ctx);
      }
      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Returns structured form lifecycle telemetry from the host (`getFormState()`),
   * or `null` when the host bridge does not expose `getFormState`.
   */
  getFormState(forceRefresh = false): ErpFormStateSnapshot | null {
    if (!this.isAvailable || typeof window.DynamicERP?.getFormState !== 'function') {
      return null;
    }
    const now = Date.now();
    if (!forceRefresh && this.lastFormStateCache && (now - this.lastFormStateCache.time < 100)) {
      return this.lastFormStateCache.val;
    }
    try {
      const state = window.DynamicERP.getFormState() ?? null;
      this.lastFormStateCache = { time: now, val: state };
      return state;
    } catch (err) {
      this.telemetry?.logBridge('getFormState', undefined, null, err);
      return null;
    }
  }

  /**
   * Queries host bridge capability metadata (`getCapabilities()`).
   * Returns `null` when unavailable or if the host throws.
   */
  getCapabilities(): ErpBridgeCapabilities | null {
    if (!this.isAvailable || typeof window.DynamicERP?.getCapabilities !== 'function') {
      return null;
    }
    try {
      const caps = window.DynamicERP.getCapabilities() ?? null;
      this.telemetry?.logBridge('getCapabilities', undefined, caps);
      return caps;
    } catch (err) {
      this.telemetry?.logBridge('getCapabilities', undefined, null, err);
      return null;
    }
  }

  /**
   * Feature-detects host contract `>= 2.5.0` using strictly `capabilities.contractVersion`
   * (never `version`) plus presence of all required v2.5.0 bridge methods.
   */
  supportsContractV250(): boolean {
    if (!this.isAvailable || !window.DynamicERP) return false;
    const caps = this.getCapabilities();
    if (!isContractVersionAtLeast(caps?.contractVersion, '2.5.0')) {
      return false;
    }
    const bridge = window.DynamicERP as unknown as Record<string, unknown>;
    const missingMethods = REQUIRED_V250_METHODS.filter((m) => typeof bridge[m] !== 'function');
    if (missingMethods.length > 0) {
      this.telemetry?.log(
        'BRIDGE',
        'contractVersion >= 2.5.0 declared but required host methods are missing',
        { contractVersion: caps?.contractVersion, missingMethods },
        'WARN'
      );
      return false;
    }
    return true;
  }

  /**
   * Calls `fetchLookupData(spec.droModel)` with strict `{ status, data, count }` and per-row
   * `{ valueKey, textKey }` validation. Retries up to `maxEmptyRetries` (default 3) at
   * `retryDelayMs` (~500ms) when host reports `status: 'empty'` while still loading, returning
   * `'not_loaded'` if all retries remain `'empty'`.
   */
  async fetchLookupRowsStrict(
    spec: Pick<ErpLookupFieldSpec, 'droModel' | 'valueKey' | 'textKey'>,
    options?: { maxEmptyRetries?: number; retryDelayMs?: number }
  ): Promise<StrictLookupFetchResult> {
    if (!this.isAvailable || typeof window.DynamicERP?.fetchLookupData !== 'function') {
      return { status: 'unsupported', options: [], totalCount: 0, invalidRows: 0, attempts: 0 };
    }

    const maxEmptyRetries = Math.max(0, options?.maxEmptyRetries ?? 3);
    const retryDelayMs = Math.max(0, options?.retryDelayMs ?? 500);

    for (let attempt = 0; attempt <= maxEmptyRetries; attempt++) {
      if (attempt > 0 && retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }

      let rawRes: unknown;
      try {
        rawRes = await window.DynamicERP.fetchLookupData(spec.droModel);
      } catch (err: any) {
        this.telemetry?.logBridge('fetchLookupData', { droModel: spec.droModel, attempt: attempt + 1 }, null, err);
        return {
          status: 'error',
          options: [],
          totalCount: 0,
          invalidRows: 0,
          attempts: attempt + 1,
          errorMessage: err?.message || String(err)
        };
      }

      if (!rawRes || typeof rawRes !== 'object') {
        this.telemetry?.logBridge('fetchLookupData', { droModel: spec.droModel, attempt: attempt + 1 }, rawRes, 'Invalid response payload');
        return {
          status: 'error',
          options: [],
          totalCount: 0,
          invalidRows: 0,
          attempts: attempt + 1,
          errorMessage: 'استجابة fetchLookupData غير صالحة.'
        };
      }

      const res = rawRes as { status?: unknown; data?: unknown; count?: unknown };
      const rawStatus = typeof res.status === 'string' ? res.status.trim().toLowerCase() : '';
      const totalCount = typeof res.count === 'number' && Number.isFinite(res.count) ? res.count : 0;

      if (rawStatus === 'not_loaded') {
        this.telemetry?.log('BRIDGE', `LOOKUP_NOT_LOADED for ${spec.droModel}`, { droModel: spec.droModel, attempt: attempt + 1 }, 'WARN');
        return { status: 'not_loaded', options: [], totalCount, invalidRows: 0, attempts: attempt + 1 };
      }

      if (rawStatus === 'empty') {
        if (attempt < maxEmptyRetries) {
          this.telemetry?.log(
            'BRIDGE',
            `fetchLookupData(${spec.droModel}) returned empty (still loading), retrying`,
            { droModel: spec.droModel, attempt: attempt + 1, retryDelayMs },
            'DEBUG'
          );
          continue;
        }
        this.telemetry?.log(
          'BRIDGE',
          `LOOKUP_STILL_EMPTY_TREATED_AS_NOT_LOADED for ${spec.droModel}`,
          { droModel: spec.droModel, attempts: attempt + 1 },
          'WARN'
        );
        return { status: 'not_loaded', options: [], totalCount: 0, invalidRows: 0, attempts: attempt + 1 };
      }

      const dataArr = Array.isArray(res.data) ? res.data : null;
      if (!dataArr || dataArr.length === 0 || (typeof res.count === 'number' && res.count === 0)) {
        return { status: 'empty', options: [], totalCount, invalidRows: 0, attempts: attempt + 1 };
      }

      const validated = validateAndMapLookupRows(dataArr, spec.valueKey, spec.textKey);
      if (validated.invalidRows > 0) {
        this.telemetry?.log(
          'BRIDGE',
          `Lookup rows failed strict key check for ${spec.droModel}`,
          {
            droModel: spec.droModel,
            valueKey: spec.valueKey,
            textKey: spec.textKey,
            invalidRows: validated.invalidRows,
            totalRows: dataArr.length,
            missingKeys: validated.sampleMissingKeys
          },
          'WARN'
        );
      }

      if (validated.options.length === 0 && validated.invalidRows > 0) {
        return {
          status: 'invalid_row_schema',
          options: [],
          totalCount: dataArr.length,
          invalidRows: validated.invalidRows,
          attempts: attempt + 1
        };
      }

      this.telemetry?.logBridge(
        'fetchLookupData',
        { droModel: spec.droModel, attempt: attempt + 1 },
        { count: validated.options.length, invalidRows: validated.invalidRows }
      );
      return {
        status: 'ok',
        options: validated.options,
        totalCount: totalCount > 0 ? totalCount : dataArr.length,
        invalidRows: validated.invalidRows,
        attempts: attempt + 1
      };
    }

    return { status: 'not_loaded', options: [], totalCount: 0, invalidRows: 0, attempts: maxEmptyRetries + 1 };
  }

  /** Safe wrapper around v2.5.0 `clearTableRows() -> { ok, count }`. */
  async clearTableRows(): Promise<ErpClearTableRowsResult> {
    if (!this.isAvailable || typeof window.DynamicERP?.clearTableRows !== 'function') {
      return { ok: false, count: 0, reason: 'clearTableRows غير متاح في جسر الـ ERP.' };
    }
    this.invalidateFormCaches();
    try {
      const res = await window.DynamicERP.clearTableRows();
      this.invalidateFormCaches();
      const normalized: ErpClearTableRowsResult = {
        ok: !!res?.ok,
        count: typeof res?.count === 'number' && Number.isFinite(res.count) ? res.count : 0,
        reason: res?.reason
      };
      this.telemetry?.logBridge('clearTableRows', undefined, normalized);
      return normalized;
    } catch (err: any) {
      this.invalidateFormCaches();
      this.telemetry?.logBridge('clearTableRows', undefined, { ok: false }, err);
      return { ok: false, count: 0, reason: err?.message || 'فشل clearTableRows.' };
    }
  }

  /** Safe wrapper around v2.5.0 `selectLookup(fieldKey, id) -> { ok, reason? }`. */
  async selectLookup(fieldKey: string, id: string | number): Promise<ErpSelectLookupResult> {
    if (!this.isAvailable || typeof window.DynamicERP?.selectLookup !== 'function') {
      return { ok: false, reason: 'selectLookup غير متاح في جسر الـ ERP.' };
    }
    this.invalidateFormCaches();
    try {
      const res = await window.DynamicERP.selectLookup(fieldKey, id);
      this.invalidateFormCaches();
      const normalized: ErpSelectLookupResult = {
        ok: !!res?.ok,
        reason: res?.reason
      };
      this.telemetry?.logBridge('selectLookup', { fieldKey, id }, normalized);
      return normalized;
    } catch (err: any) {
      this.invalidateFormCaches();
      this.telemetry?.logBridge('selectLookup', { fieldKey, id }, { ok: false }, err);
      return { ok: false, reason: err?.message || `فشل selectLookup للحقل ${fieldKey}.` };
    }
  }

  /** Safe wrapper around v2.5.0 `addTableRow({ ProductID, Qty, Price?, UnitID?, StoreID?, Note? })`. */
  async addTableRow(row: ErpTableRowPayload): Promise<ErpAddTableRowResult> {
    if (!this.isAvailable || typeof window.DynamicERP?.addTableRow !== 'function') {
      return { ok: false, reason: 'addTableRow غير متاح في جسر الـ ERP.' };
    }
    this.invalidateFormCaches();
    try {
      const raw = await window.DynamicERP.addTableRow(row);
      this.invalidateFormCaches();
      const obj = raw && typeof raw === 'object' ? (raw as unknown as Record<string, unknown>) : null;
      const ok = obj?.['ok'] === true;
      const reason = obj && typeof obj['reason'] === 'string' ? obj['reason'] : undefined;
      const result: ErpAddTableRowResult = { ok, reason, raw };
      this.telemetry?.logBridge('addTableRow', row, result);
      return result;
    } catch (err: any) {
      this.invalidateFormCaches();
      this.telemetry?.logBridge('addTableRow', row, { ok: false }, err);
      return { ok: false, reason: err?.message || 'فشل addTableRow.' };
    }
  }

  /** Safe wrapper around v2.5.0 `saveDocument({ expectedPOID?, expectedPONumber? })`. */
  async saveDocument(options?: ErpSaveDocumentOptions): Promise<ErpSaveDocumentResult> {
    if (!this.isAvailable || typeof window.DynamicERP?.saveDocument !== 'function') {
      return { ok: false, errors: ['saveDocument غير متاح في جسر الـ ERP.'] };
    }
    this.invalidateFormCaches();
    try {
      const raw = options ? await window.DynamicERP.saveDocument(options) : await window.DynamicERP.saveDocument();
      this.invalidateFormCaches();
      if (!raw || typeof raw !== 'object') {
        return { ok: false, errors: ['استجابة saveDocument غير صالحة من نظام الـ ERP.'] };
      }
      const res: ErpSaveDocumentResult = {
        ok: !!raw.ok,
        POID: raw.POID,
        PONumber: raw.PONumber,
        mode: raw.mode,
        errors: Array.isArray(raw.errors) ? raw.errors : undefined
      };
      this.telemetry?.logBridge('saveDocument', options, res);
      return res;
    } catch (err: any) {
      this.invalidateFormCaches();
      const errMsg = err?.message || 'حدث خطأ أثناء تنفيذ saveDocument في نظام الـ ERP.';
      this.telemetry?.logBridge('saveDocument', options, { ok: false, errors: [errMsg] }, err);
      return { ok: false, errors: [errMsg] };
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
