import {
  normalizeArabicText,
  resolveKeysToTry,
  convertEasternToWesternNumerals,
} from './arabic-normalizer';
import { getActiveFormRoot, waitFor, highlightElement } from './dom-synchronizer';

/**
 * Resilient target element finder:
 * 1. Matches by name, id, data-testid, placeholder (ignoring surrounding quotes)
 * 2. Matches known aliases (e.g. POSetting <-> طريقة الشراء, StoreID <-> المخزن)
 * 3. Matches by Arabic label association
 */
export function findTargetElement(
  key: string,
  excludeContainer?: HTMLElement
): HTMLElement | null {
  if (typeof document === 'undefined' || !key) return null;

  const clean = key.trim().replace(/^['"]|['"]$/g, '');
  const formRoot = getActiveFormRoot();

  const keysToTry = resolveKeysToTry(clean);

  for (const searchKey of keysToTry) {
    // 1. Check custom dropdown hosts first (by name, id, formcontrolname, data-field)
    const customSelector = [
      `eg-select[name="${searchKey}" i]`,
      `ng-select[name="${searchKey}" i]`,
      `[name="${searchKey}" i]`,
      `eg-select[id="${searchKey}" i]`,
      `ng-select[id="${searchKey}" i]`,
      `[id="${searchKey}" i]`,
      `eg-select[formcontrolname="${searchKey}" i]`,
      `ng-select[formcontrolname="${searchKey}" i]`,
      `[formcontrolname="${searchKey}" i]`,
      `[data-field="${searchKey}" i]`,
      `[data-copilot-field="${searchKey}" i]`,
      `[data-copilot-alias="${searchKey}" i]`,
      `[placeholder="${searchKey}" i]`,
      `[aria-label="${searchKey}" i]`,
    ].join(', ');

    const customCandidates = Array.from(
      formRoot.querySelectorAll(customSelector)
    ) as HTMLElement[];
    for (const cand of customCandidates) {
      if (excludeContainer && excludeContainer.contains(cand)) continue;
      return cand;
    }

    // 2. Check standard inputs / selects / textareas (by name, id, formcontrolname, data-testid, data-field)
    const safeSelector = [
      `input[name="${searchKey}" i]`,
      `select[name="${searchKey}" i]`,
      `textarea[name="${searchKey}" i]`,
      `input[id="${searchKey}" i]`,
      `select[id="${searchKey}" i]`,
      `textarea[id="${searchKey}" i]`,
      `input[formcontrolname="${searchKey}" i]`,
      `select[formcontrolname="${searchKey}" i]`,
      `textarea[formcontrolname="${searchKey}" i]`,
      `[data-testid="${searchKey}" i]`,
      `[data-field="${searchKey}" i]`,
    ].join(', ');

    const elements = Array.from(
      formRoot.querySelectorAll(safeSelector)
    ) as HTMLElement[];
    for (const el of elements) {
      if (excludeContainer && excludeContainer.contains(el)) continue;
      return el;
    }
  }

  // 3. Fallback: match by label text
  const normalizedKey = normalizeArabicText(clean);
  const labels = Array.from(formRoot.querySelectorAll('label'));
  for (const lbl of labels) {
    if (excludeContainer && excludeContainer.contains(lbl)) continue;
    const lblText = normalizeArabicText(lbl.textContent || '');
    if (
      lblText &&
      (lblText === normalizedKey ||
        lblText.includes(normalizedKey) ||
        normalizedKey.includes(lblText))
    ) {
      const group = lbl.closest('.form-group, .row, .field-wrapper, div');
      if (group) {
        const target = group.querySelector(
          'eg-select, ng-select, select, input, textarea'
        ) as HTMLElement;
        if (target && (!excludeContainer || !excludeContainer.contains(target))) {
          return target;
        }
      }
    }
  }

  return null;
}

/**
 * Sets text/date/number input using prototype setter to ensure Angular Reactive Forms detect change.
 */
export function setTextOrDate(
  el: HTMLInputElement | HTMLTextAreaElement,
  val: any,
  telemetry?: any
): void {
  try {
    el.focus();
  } catch {
    // ignore focus error
  }

  let strVal = String(val ?? '');
  if (
    el instanceof HTMLInputElement &&
    (el.type === 'number' || el.type === 'date' || el.type === 'datetime-local')
  ) {
    strVal = convertEasternToWesternNumerals(strVal);
  }

  const prototype =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) {
    setter.call(el, strVal);
  } else {
    el.value = strVal;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));

  // Verification check
  const expectedStr = strVal.trim();
  const actualStr = (el.value || '').trim();
  if (actualStr !== expectedStr && !actualStr.includes(expectedStr)) {
    // Retry once with simulated key events
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true }));
    if (setter) {
      setter.call(el, strVal);
    } else {
      el.value = strVal;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Unidentified', bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    const finalStr = (el.value || '').trim();
    if (finalStr !== expectedStr && !finalStr.includes(expectedStr)) {
      telemetry?.log(
        'FILL',
        'verify_mismatch on input',
        {
          elementId: el.id || el.getAttribute('name') || el.getAttribute('placeholder'),
          expected: expectedStr,
          actual: finalStr,
        },
        'WARN'
      );
    }
  }

  highlightElement(el);
}

/**
 * Sets value on native <select> matching by value or visible text.
 */
export function setNativeSelect(selectEl: HTMLSelectElement, val: any): boolean {
  const strVal = normalizeArabicText(String(val));
  let matched = false;

  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i];
    const optVal = normalizeArabicText(opt.value);
    const optText = normalizeArabicText(opt.text);

    if (optVal === strVal || optText === strVal || optText.includes(strVal)) {
      selectEl.selectedIndex = i;
      matched = true;
      break;
    }
  }

  if (!matched) {
    selectEl.value = String(val);
  }

  selectEl.dispatchEvent(new Event('input', { bubbles: true }));
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  selectEl.dispatchEvent(new Event('blur', { bubbles: true }));
  highlightElement(selectEl);
  return true;
}

/**
 * Sets value on @ng-select/ng-select component with typeahead support.
 */
export async function setNgSelect(
  hostEl: HTMLElement,
  searchTerm: any,
  telemetry?: any
): Promise<'filled' | 'ambiguous' | 'not_found'> {
  const startTime = Date.now();
  try {
    const ngSelect = (hostEl.tagName.toLowerCase() === 'ng-select'
      ? hostEl
      : hostEl.querySelector('ng-select')) as HTMLElement;

    if (!ngSelect) return 'not_found';

    const input = (ngSelect.querySelector('input[role="combobox"]') ||
      ngSelect.querySelector('input')) as HTMLInputElement;

    if (!input) return 'not_found';

    // 1. Focus input and click container to trigger dropdown open
    const container = (ngSelect.querySelector('.ng-select-container') || ngSelect) as HTMLElement;
    container.click();
    input.focus();

    const termStr = String(searchTerm).trim();

    const performSearch = async (term: string): Promise<'filled' | 'ambiguous' | 'not_found'> => {
      // Prototype setter
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(input, term);
      } else {
        input.value = term;
      }

      // Dispatch keydown, input, keyup so remote typeahead and reactive debouncers trigger reliably
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Process' }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Process' }));

      // 3. Find dropdown panel: target the latest open visible panel attached to body or inside select
      const panel = await waitFor<HTMLElement>(() => {
        const panels = Array.from(
          document.querySelectorAll('body > ng-dropdown-panel, ng-dropdown-panel, .ng-dropdown-panel')
        ) as HTMLElement[];
        const visiblePanels = panels.filter(
          (p) => !p.hasAttribute('hidden') && p.style.display !== 'none' && (p.offsetWidth > 0 || p.offsetHeight > 0)
        );
        return visiblePanels.length > 0 ? visiblePanels[visiblePanels.length - 1] : (panels[panels.length - 1] || null);
      }, 2000);

      if (!panel) {
        console.warn('[ControlInteractor] ng-dropdown-panel not found for ng-select');
        return 'not_found';
      }

      // Wait for spinner / loading indicator to disappear first if present
      await waitFor<boolean>(() => {
        const loadingEl = panel.querySelector('.ng-spinner-loader, .ng-load-more, .loading');
        return !loadingEl;
      }, 2500);

      // 4. Wait for .ng-option items to render (expanded to 3000ms for slow remote APIs)
      const options = await waitFor<HTMLElement[]>(() => {
        const items = (Array.from(panel.querySelectorAll('.ng-option')) as HTMLElement[]).filter(
          (o) => !o.classList.contains('ng-option-disabled')
        );
        return items.length > 0 ? items : null;
      }, 3000);

      const optionsCount = options?.length || 0;

      if (!options || optionsCount === 0) {
        return 'not_found';
      }

      // 5. Match option text using normalized Arabic with candidate scoring
      const normalizedTarget = normalizeArabicText(term);
      let exactMatch: HTMLElement | null = null;
      const candidateMatches: { el: HTMLElement; score: number; optText: string }[] = [];

      for (const opt of options) {
        const labelEl = opt.querySelector('.ng-option-label') || opt;
        const rawOptText = (labelEl.textContent || '').trim();
        const optText = normalizeArabicText(rawOptText);
        const cleanedOptText = optText
          .replace(/^[0-9\-_[\]#\s.:]+/, '')
          .replace(/[0-9\-_[\]#\s.:]+$/, '')
          .trim();

        if (optText === normalizedTarget || cleanedOptText === normalizedTarget) {
          exactMatch = opt;
          break;
        }

        if (cleanedOptText.includes(normalizedTarget) || optText.includes(normalizedTarget)) {
          const lengthDiff = Math.abs(cleanedOptText.length - normalizedTarget.length);
          candidateMatches.push({ el: opt, score: 100 - lengthDiff, optText });
        } else {
          const targetWords = normalizedTarget.split(/\s+/).filter((w) => w.length > 1);
          let matchedWords = 0;
          for (const tw of targetWords) {
            if (cleanedOptText.includes(tw)) matchedWords++;
          }
          if (matchedWords >= 2 || (targetWords.length === 1 && matchedWords === 1)) {
            candidateMatches.push({
              el: opt,
              score: (matchedWords / targetWords.length) * 50 - Math.abs(cleanedOptText.length - normalizedTarget.length),
              optText,
            });
          }
        }
      }

      candidateMatches.sort((a, b) => b.score - a.score);
      const matchToClick = exactMatch || (candidateMatches.length > 0 ? candidateMatches[0].el : null);

      if (matchToClick) {
        matchToClick.click();
        highlightElement(ngSelect);
        const elapsedMs = Date.now() - startTime;

        // Verify .ng-value-label rendered
        setTimeout(() => {
          const valueLabel = ngSelect.querySelector('.ng-value-label, .ng-value');
          if (!valueLabel || !valueLabel.textContent?.trim()) {
            telemetry?.log(
              'FILL',
              'verify_mismatch on ng-select',
              {
                term,
                elementId: ngSelect.id || ngSelect.getAttribute('name'),
                reason: 'No .ng-value-label rendered after option selection',
              },
              'WARN'
            );
          }
        }, 80);

        telemetry?.log('FILL', `ng-select matched option for '${term}'`, {
          term,
          optionsCount,
          elapsedMs,
          selected: (matchToClick.textContent || '').trim(),
        });
        return 'filled';
      }

      return 'not_found';
    };

    let result = await performSearch(termStr);

    // If not found and search term contains multiple words, retry once with the first primary word
    if (result === 'not_found') {
      const words = termStr.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 1) {
        const firstWord = words[0];
        console.info(`[ControlInteractor] Retrying ng-select with first word: "${firstWord}"`);
        result = await performSearch(firstWord);
      }
    }

    // If still not found or ambiguous, hit Escape to close the hanging dropdown panel cleanly
    if (result !== 'filled') {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      const elapsedMs = Date.now() - startTime;
      telemetry?.log(
        'FILL',
        `ng-select failed for '${termStr}' (${result})`,
        {
          term: termStr,
          result,
          elapsedMs,
        },
        'WARN'
      );
    }

    return result;
  } catch (err) {
    console.warn('[ControlInteractor] Error in setNgSelect:', err);
    telemetry?.logError('FILL', 'setNgSelect error', err);
    return 'not_found';
  }
}

/**
 * Reads calculated total or net invoice amount from DOM fields.
 */
export function readCalculatedTotal(excludeContainer?: HTMLElement): string | null {
  if (typeof document === 'undefined') return null;

  const formRoot = getActiveFormRoot();

  // Search for inputs matching total / net / sum
  const selectors = [
    'input[name*="total" i]',
    'input[name*="net" i]',
    'input[id*="total" i]',
    'input[id*="net" i]',
    'input[formcontrolname*="total" i]',
    'input[formcontrolname*="net" i]',
    '[data-testid*="total" i]',
    '[data-field*="total" i]',
  ];

  for (const sel of selectors) {
    const el = formRoot.querySelector(sel) as HTMLInputElement;
    if (el && (!excludeContainer || !excludeContainer.contains(el)) && el.value && el.value.trim()) {
      const num = el.value.trim().replace(/,/g, '');
      if (!isNaN(Number(num)) && Number(num) > 0) return num;
    }
  }

  // Try finding label with "إجمالي" or "صافي"
  const labels = Array.from(formRoot.querySelectorAll('label'));
  for (const lbl of labels) {
    if (excludeContainer && excludeContainer.contains(lbl)) continue;
    const text = normalizeArabicText(lbl.textContent || '');
    if (text.includes('اجمالي') || text.includes('صافي')) {
      const group = lbl.closest('.form-group, .row, div');
      const input = group?.querySelector('input') as HTMLInputElement;
      if (input && input.value && input.value.trim()) {
        const num = input.value.trim().replace(/,/g, '');
        if (!isNaN(Number(num)) && Number(num) > 0) return num;
      }
      const textEl = group?.querySelector('.form-control-static, span, div, strong') as HTMLElement;
      if (textEl && textEl.textContent && textEl.textContent.trim()) {
        const num = textEl.textContent.trim().replace(/,/g, '').replace(/[^\d.]/g, '');
        if (!isNaN(Number(num)) && Number(num) > 0) return num;
      }
    }
  }

  // Try finding footer or summary table cells
  const footerCells = Array.from(
    formRoot.querySelectorAll('tfoot td, .total-value, .net-value, [class*="total"]')
  ) as HTMLElement[];
  for (const cell of footerCells) {
    if (excludeContainer && excludeContainer.contains(cell)) continue;
    const text = cell.textContent?.trim().replace(/,/g, '').replace(/[^\d.]/g, '') || '';
    if (text && !isNaN(Number(text)) && Number(text) > 0) {
      return text;
    }
  }

  return null;
}
