import { ErpMissingFieldInfo } from '../../../models/erp-bridge.models';
import { FormFieldSchema, FormFillResult } from '../../../models/erp-form.models';
import { normalizeArabicText } from '../form-driver/arabic-normalizer';
import { findTargetElement } from '../form-driver/control-interactor';
import { getActiveFormRoot } from '../form-driver/dom-synchronizer';

export interface CapturedSaveToast {
  text: string;
  kind: 'error' | 'warning' | 'success' | 'info';
  docId?: string;
}

const ERROR_TOAST_PATTERN =
  /برجاء|يرجى|مطلوب|يجب|ادخال|إدخال|اختيار|تحديد|ناقص|فارغ|خطأ|عفوا|لا يمكن|تعذر|فشل|غير صحيح|غير صالح|required|invalid|missing|error|warning/i;

const SUCCESS_TOAST_PATTERN =
  /تم الحفظ|تمت الاضافة|تمت الإضافة|تم التسجيل|بنجاح|نجاح|saved|successfully/i;

const SEMANTIC_FIELD_HINTS: Array<{ pattern: RegExp; key: string; label: string }> = [
  { pattern: /طريقه الشراء|طريقة الشراء|نوع الشراء|اعدادات الشراء/i, key: 'POSetting', label: 'طريقة الشراء' },
  { pattern: /طريقه البيع|طريقة البيع|نوع البيع|نوع العقد/i, key: 'ContractType', label: 'طريقة البيع' },
  { pattern: /العمله|العملة|عمله الشراء|عملة الشراء/i, key: 'CurrancyID', label: 'العملة' },
  { pattern: /المخزن|المستودع/i, key: 'StoreID', label: 'المخزن' },
  { pattern: /المورد/i, key: 'SupplierID', label: 'المورد' },
  { pattern: /العميل/i, key: 'CustomerID', label: 'العميل' },
  { pattern: /الخزينه|الخزينة|الصندوق|حساب الخزينه/i, key: 'SafeAccounId', label: 'الخزينة' },
  { pattern: /المشروع/i, key: 'ProjectID', label: 'المشروع' },
  { pattern: /مركز التكلفه|مركز التكلفة/i, key: 'CostItemId', label: 'مركز التكلفة' },
  { pattern: /المندوب|الموظف/i, key: 'EmployeeId', label: 'الموظف / المندوب' },
];

function isElementVisible(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.offsetWidth <= 0 && el.offsetHeight <= 0 && el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

function triggerFullClick(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {}
  for (const type of ['mousedown', 'mouseup', 'click'] as const) {
    el.dispatchEvent(
      new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 })
    );
  }
}

/**
 * Inspects the DOM shortly after clicking the primary Save button to see if a split-button
 * or dropdown menu opened (e.g. `<span class="dp-menu_text">حفظ</span>`), and clicks the save option.
 */
export async function completeSaveMenuSubOption(
  preferredText: string = 'حفظ',
  maxWaitMs: number = 400
): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined;

  const start = Date.now();
  const normPreferred = normalizeArabicText(preferredText).trim();

  while (Date.now() - start < maxWaitMs) {
    const menuSpans = Array.from(
      document.querySelectorAll<HTMLElement>(
        'span.dp-menu_text, span.dp-menu__text, [class*="dp-menu"] span, .cdk-overlay-container [role="menuitem"], .dp-menu li, .dp-menu button, .dropdown-menu.show a, .dropdown-menu.show button'
      )
    ).filter((el) => !el.closest('lms-ai-copilot, app-copilot-chat') && isElementVisible(el));

    if (menuSpans.length > 0) {
      // 1. Exact match on preferredText (typically 'حفظ')
      let match = menuSpans.find(
        (el) => normalizeArabicText(el.textContent || '').trim() === normPreferred
      );

      // 2. Fallback to any option starting with 'حفظ' (excluding cancel/delete)
      if (!match) {
        match = menuSpans.find((el) => {
          const txt = normalizeArabicText(el.textContent || '').trim();
          return txt.startsWith('حفظ') && !txt.includes('الغاء') && !txt.includes('حذف');
        });
      }

      if (match) {
        const clickableTarget =
          (match.closest('button, li, a, [role="menuitem"], .dp-menu__item, .dp-menu_item') as HTMLElement) ||
          match;
        const clickedLabel = (match.textContent || 'حفظ').trim();
        console.info(
          '%c[ErpSaveVerifier] Clicked Save sub-menu option:',
          'color:#10b981;font-weight:bold',
          clickedLabel,
          clickableTarget
        );
        triggerFullClick(clickableTarget);
        return clickedLabel;
      }
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  return undefined;
}

function parseToastElement(el: HTMLElement): CapturedSaveToast | null {
  const rawText = (el.innerText || el.textContent || el.getAttribute('aria-label') || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!rawText || rawText.length < 2) return null;

  const cls = (el.className || '').toLowerCase();
  let kind: CapturedSaveToast['kind'] = 'info';

  if (
    cls.includes('toast-error') ||
    cls.includes('dp-toast-error') ||
    cls.includes('alert-danger') ||
    cls.includes('swal2-icon-error')
  ) {
    kind = 'error';
  } else if (
    cls.includes('toast-warning') ||
    cls.includes('dp-toast-warning') ||
    cls.includes('alert-warning')
  ) {
    kind = 'warning';
  } else if (
    cls.includes('toast-success') ||
    cls.includes('dp-toast-success') ||
    cls.includes('alert-success')
  ) {
    kind = 'success';
  } else if (ERROR_TOAST_PATTERN.test(rawText) && !SUCCESS_TOAST_PATTERN.test(rawText)) {
    kind = 'error';
  } else if (SUCCESS_TOAST_PATTERN.test(rawText)) {
    kind = 'success';
  }

  const docMatch = rawText.match(/(?:رقم|مستند|#)\s*[:#-]?\s*(\d+)/);
  return {
    text: rawText,
    kind,
    docId: docMatch ? docMatch[1] : undefined,
  };
}

/**
 * Attaches a real-time MutationObserver to `#toast-container.dp-toast-top-end` and `.overlay-container`
 * BEFORE executing the save action so transient ngx-toastr notifications are captured immediately.
 */
export async function observeSaveToastAndValidation<T>(
  saveAction: () => Promise<T>,
  settleWindowMs: number = 950
): Promise<{
  actionResult: T;
  toasts: CapturedSaveToast[];
  subMenuClicked?: string;
}> {
  if (typeof document === 'undefined') {
    const actionResult = await saveAction();
    return { actionResult, toasts: [] };
  }

  const capturedMap = new Map<string, CapturedSaveToast>();

  const scanToastNodes = (root: ParentNode) => {
    const toastSelectors = [
      '#toast-container > div',
      '.dp-toast-top-end > div',
      '.overlay-container .ngx-toastr',
      '.overlay-container [toast-component]',
      '.toast-container .ngx-toastr',
      '.toast-container .toast',
      '.swal2-container .swal2-popup',
    ].join(', ');

    const nodes = Array.from(root.querySelectorAll<HTMLElement>(toastSelectors));
    for (const node of nodes) {
      if (node.closest('lms-ai-copilot, app-copilot-chat')) continue;
      const parsed = parseToastElement(node);
      if (parsed && !capturedMap.has(parsed.text)) {
        capturedMap.set(parsed.text, parsed);
        console.info(
          `%c[ErpSaveVerifier] Captured live ERP toast [${parsed.kind.toUpperCase()}]:`,
          parsed.kind === 'error' || parsed.kind === 'warning'
            ? 'color:#ef4444;font-weight:bold'
            : 'color:#10b981;font-weight:bold',
          parsed.text
        );
      }
    }
  };

  const observerTarget =
    document.querySelector('.overlay-container') ||
    document.getElementById('toast-container') ||
    document.body;

  const observer = new MutationObserver(() => {
    scanToastNodes(document);
  });

  observer.observe(observerTarget, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  let actionResult!: T;
  let subMenuClicked: string | undefined;

  try {
    actionResult = await saveAction();
    // Immediately check if clicking Save opened `<span class="dp-menu_text">حفظ</span>`
    subMenuClicked = await completeSaveMenuSubOption('حفظ', 380);

    // Wait briefly for ERP validation or backend response toast to render inside #toast-container
    const waitStart = Date.now();
    while (Date.now() - waitStart < settleWindowMs) {
      scanToastNodes(document);
      if (capturedMap.size > 0) {
        // Wait an extra 100ms in case multiple validation lines appear together
        await new Promise((r) => setTimeout(r, 100));
        scanToastNodes(document);
        break;
      }
      await new Promise((r) => setTimeout(r, 70));
    }
  } finally {
    observer.disconnect();
  }

  return {
    actionResult,
    toasts: Array.from(capturedMap.values()),
    subMenuClicked,
  };
}

/**
 * Correlates captured toast validation errors and DOM `.ng-invalid` controls with active form schema
 * to identify exactly which field(s) are missing and what dropdown options are available.
 */
export function detectMissingFieldsFromToastAndDom(
  toastMessages: string[],
  schemas: FormFieldSchema[],
  excludeContainer?: HTMLElement
): ErpMissingFieldInfo[] {
  const missing: ErpMissingFieldInfo[] = [];
  const addedKeys = new Set<string>();

  const combinedNormToast = normalizeArabicText(toastMessages.join(' | '));

  // 1. Match fields explicitly mentioned in the toast text against live form schema
  for (const s of schemas) {
    if (s.disabled) continue;
    const normLabel = normalizeArabicText(s.label || '');
    const normKey = normalizeArabicText(s.key || '');
    if (
      (normLabel.length >= 2 && combinedNormToast.includes(normLabel)) ||
      (normKey.length >= 3 && combinedNormToast.includes(normKey))
    ) {
      if (!addedKeys.has(s.key)) {
        addedKeys.add(s.key);
        missing.push({
          key: s.key,
          label: s.label || s.key,
          kind: s.kind,
          options: s.options && s.options.length > 0 ? s.options : undefined,
          reason: toastMessages[0],
        });
      }
    }
  }

  // 2. Check semantic field hints if toast uses a synonym (e.g. "برجاء اختيار طريقة الشراء" -> POSetting)
  for (const hint of SEMANTIC_FIELD_HINTS) {
    if (hint.pattern.test(toastMessages.join(' ')) || hint.pattern.test(combinedNormToast)) {
      const schemaMatch = schemas.find(
        (s) =>
          s.key.toLowerCase() === hint.key.toLowerCase() ||
          normalizeArabicText(s.label).includes(normalizeArabicText(hint.label))
      );
      const targetKey = schemaMatch?.key || hint.key;
      if (!addedKeys.has(targetKey)) {
        addedKeys.add(targetKey);
        missing.push({
          key: targetKey,
          label: schemaMatch?.label || hint.label,
          kind: schemaMatch?.kind || 'ng-select',
          options: schemaMatch?.options,
          reason: toastMessages[0],
        });
      }
    }
  }

  // 3. Scan DOM for controls marked invalid (.ng-invalid.ng-touched / [aria-invalid="true"]) or empty required
  if (typeof document !== 'undefined') {
    const formRoot = getActiveFormRoot();
    for (const s of schemas) {
      if (s.disabled || addedKeys.has(s.key)) continue;
      const el = findTargetElement(s.key, excludeContainer);
      if (!el) continue;

      const isInvalidClass =
        el.classList.contains('is-invalid') ||
        (el.classList.contains('ng-invalid') &&
          (el.classList.contains('ng-touched') || el.classList.contains('ng-dirty') || toastMessages.length > 0));

      const isEmptyRequired = s.required && !isControlPopulatedInDom(el);

      if (isInvalidClass || isEmptyRequired) {
        if (!isControlPopulatedInDom(el)) {
          addedKeys.add(s.key);
          missing.push({
            key: s.key,
            label: s.label || s.key,
            kind: s.kind,
            options: s.options,
          });
        }
      }
    }

    // Also check if any input/ng-select directly inside formRoot has .ng-invalid and wasn't matched yet
    if (missing.length === 0 && toastMessages.length > 0) {
      const invalidEls = Array.from(
        formRoot.querySelectorAll<HTMLElement>(
          'ng-select.ng-invalid, eg-select.ng-invalid, input.ng-invalid, select.ng-invalid, .is-invalid'
        )
      ).filter((el) => (!excludeContainer || !excludeContainer.contains(el)) && isElementVisible(el));

      for (const invEl of invalidEls) {
        if (isControlPopulatedInDom(invEl)) continue;
        const fcName =
          invEl.getAttribute('formcontrolname') ||
          invEl.getAttribute('name') ||
          invEl.id ||
          '';
        if (!fcName || addedKeys.has(fcName)) continue;
        const schemaMatch = schemas.find((s) => s.key.toLowerCase() === fcName.toLowerCase());
        addedKeys.add(fcName);
        missing.push({
          key: schemaMatch?.key || fcName,
          label: schemaMatch?.label || fcName,
          kind: schemaMatch?.kind || invEl.tagName.toLowerCase(),
          options: schemaMatch?.options,
          reason: toastMessages[0],
        });
      }
    }
  }

  return missing;
}

/**
 * Checks whether a DOM control genuinely holds a non-empty value after form fill.
 */
export function isControlPopulatedInDom(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'ng-select' || tag === 'eg-select' || el.classList.contains('ng-select')) {
    if (el.classList.contains('ng-has-value')) return true;
    const valLabels = el.querySelectorAll('.ng-value-label, .ng-value');
    for (const vl of Array.from(valLabels)) {
      if ((vl.textContent || '').trim().length > 0) return true;
    }
    const innerInput = el.querySelector('input') as HTMLInputElement | null;
    if (innerInput && innerInput.value && innerInput.value.trim().length > 0) return true;
    return false;
  }

  if (el instanceof HTMLSelectElement) {
    return !!el.value && el.selectedIndex >= 0;
  }

  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return true;
    return el.value.trim().length > 0;
  }

  if (el instanceof HTMLTextAreaElement) {
    return el.value.trim().length > 0;
  }

  return true;
}

/**
 * Closed-Loop Post-Fill Assertion:
 * Verifies each field reported as 'filled' against the actual DOM element state.
 */
export function verifyPostFillAssertions(
  results: FormFillResult[],
  excludeContainer?: HTMLElement
): FormFillResult[] {
  if (typeof document === 'undefined') return results;

  return results.map((res) => {
    if (res.status !== 'filled' || res.field.startsWith('row_')) {
      return res;
    }
    const el = findTargetElement(res.field, excludeContainer);
    if (!el) return res;

    if (!isControlPopulatedInDom(el)) {
      return {
        ...res,
        status: 'not_found',
        message: 'لم يحتفظ الحقل بالقيمة في الشاشة (قد يكون مقيداً بحقل آخر)',
      };
    }
    return res;
  });
}

