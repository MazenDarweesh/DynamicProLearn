import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  FormFieldSchema,
  FormFillResult,
  FormFillExecutionReport,
  FieldKind,
  FieldGroup,
  FieldSignatureIn,
  LeftoverResponse,
  ControlIn,
} from '../models/erp-form.models';
import { CopilotService } from './copilot.service';
import { ErpTelemetryService } from './erp-telemetry.service';
import { ErpBridgeService } from './erp-bridge.service';

/**
 * Normalizes Arabic text for flexible matching:
 * - Removes diacritics / tashkeel
 * - Unifies Alef shapes (أ, إ, آ -> ا)
 * - Unifies Taa Marbuta / Haa (ة -> ه)
 * - Unifies Yaa / Alef Maksura (ى -> ي)
 * - Trims and collapses multiple spaces
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

@Injectable({
  providedIn: 'root',
})
export class ErpFormDriverService {
  private copilotService = inject(CopilotService, { optional: true });
  private telemetry = inject(ErpTelemetryService, { optional: true });
  private bridge = inject(ErpBridgeService, { optional: true });

  /**
   * Resolves the live form container so hidden background tabs are never inspected.
   * Order: floating modal form → visible tab's form → visible tab → whole document (non-ERP/mock hosts).
   */
  getActiveFormRoot(): ParentNode {
    if (typeof document === 'undefined') return document;
    const root =
      document.querySelector('.cdk-overlay-container .dp-modal app-add-or-edit') ||
      document.querySelector('.dp-shell__pages > div:not([hidden]) app-add-or-edit') ||
      document.querySelector('.dp-shell__pages > div:not([hidden])');
    return root || document;
  }

  /**
   * Waits for a condition to be satisfied using MutationObserver without arbitrary setTimeout.
   */
  async waitFor<T>(
    predicate: () => T | null | undefined,
    timeoutMs: number = 2000
  ): Promise<T | null> {
    if (typeof document === 'undefined') return null;

    const initial = predicate();
    if (initial) return initial;

    return new Promise<T | null>((resolve) => {
      let timeoutId: any;
      const observer = new MutationObserver(() => {
        const result = predicate();
        if (result) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(result);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      timeoutId = setTimeout(() => {
        observer.disconnect();
        resolve(predicate() || null);
      }, timeoutMs);
    });
  }

  /**
   * Waits for DOM mutations to quiesce (settle) within container, with a safety ceiling.
   * Ensures Angular change detection, component transitions, and dependent field rendering
   * are completely finished before the next field is inspected or filled.
   */
  async settle(
    container?: HTMLElement,
    options: { quietMs?: number; maxMs?: number } = {}
  ): Promise<void> {
    if (typeof document === 'undefined') return;

    const quietMs = options.quietMs ?? 60;
    const maxMs = options.maxMs ?? 800;
    const target = container || document.body;

    return new Promise<void>((resolve) => {
      let timeoutId: any;
      let maxTimeoutId: any;
      let observer: MutationObserver | null = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (maxTimeoutId) clearTimeout(maxTimeoutId);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        resolve();
      };

      maxTimeoutId = setTimeout(() => {
        cleanup();
      }, maxMs);

      const resetQuietTimer = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          cleanup();
        }, quietMs);
      };

      observer = new MutationObserver(() => {
        resetQuietTimer();
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      // Start initial quiet timer
      resetQuietTimer();
    });
  }

  /**
   * Compares two form schemas to identify newly revealed or newly enabled fields.
   */
  diffSchemas(
    before: FormFieldSchema[],
    after: FormFieldSchema[]
  ): { newlyAppeared: FormFieldSchema[]; newlyEnabled: FormFieldSchema[] } {
    const beforeMap = new Map(before.map((f) => [f.key, f]));
    const newlyAppeared: FormFieldSchema[] = [];
    const newlyEnabled: FormFieldSchema[] = [];

    for (const field of after) {
      const prev = beforeMap.get(field.key);
      if (!prev) {
        newlyAppeared.push(field);
      } else if (prev.disabled && !field.disabled) {
        newlyEnabled.push(field);
      }
    }

    return { newlyAppeared, newlyEnabled };
  }

  /**
   * Scans the host ERP DOM to collect a rich schema of form fields,
   * categorizing them into Header, Grid, and Footer, and identifying
   * ng-select, native selects, checkboxes, and disabled auto-fill fields.
   */
  collectFormSchema(excludeContainer?: HTMLElement): FormFieldSchema[] {
    if (typeof document === 'undefined') return [];
    try {
      const schemas: FormFieldSchema[] = [];
      const seenKeys = new Set<string>();

      const formRoot = this.getActiveFormRoot();

      // 1. Gather custom dropdown hosts (e.g. <eg-select>, <ng-select>, <mat-select>)
      const customSelectHosts = Array.from(
        formRoot.querySelectorAll('eg-select, ng-select, mat-select')
      ) as HTMLElement[];

      for (const host of customSelectHosts) {
        if (excludeContainer && excludeContainer.contains(host)) continue;

        const tagName = host.tagName.toLowerCase();
        const isNgSelect = tagName === 'eg-select' || tagName === 'ng-select';
        const isMatSelect = tagName === 'mat-select';

        const rawName =
          host.getAttribute('name') ||
          host.getAttribute('formcontrolname') ||
          host.id ||
          host.getAttribute('data-field') ||
          '';
        const cleanName = rawName.replace(/^['"]|['"]$/g, '').trim();

        const labelText = this.findLabelForElement(host);
        const key = cleanName || (labelText ? `select_${labelText}` : 'custom_select');

        const kind: FieldKind = isNgSelect ? 'ng-select' : isMatSelect ? 'mat-select' : 'select';
        const group: FieldGroup = this.determineFieldGroup(host);
        const disabled = host.classList.contains('disabled') || host.getAttribute('aria-disabled') === 'true';

        const descriptorKey = `${key}__${labelText}`;
        if (!seenKeys.has(descriptorKey)) {
          seenKeys.add(descriptorKey);
          schemas.push({
            key: cleanName || labelText || key,
            label: labelText,
            kind,
            group,
            disabled,
            required: host.getAttribute('aria-required') === 'true',
          });
        }
      }

      // 2. Gather standard input, select, textarea elements
      const inputs = Array.from(
        formRoot.querySelectorAll('input, select, textarea')
      ) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];

      for (const el of inputs) {
        if (excludeContainer && excludeContainer.contains(el)) continue;

        // Skip internal combobox inputs of already captured ng-select/mat-select hosts
        if (el.closest('ng-select, eg-select, mat-select')) continue;
        if (el.type === 'hidden') continue;

        // Skip table pagination, master-list internal search bar, and numeric row checkboxes
        if (el.closest('.dp-table__pagination, app-master-list-switch, .dataTables_paginate')) continue;

        const rawName =
          el.getAttribute('name') ||
          el.getAttribute('formcontrolname') ||
          el.id ||
          el.getAttribute('placeholder') ||
          '';
        const cleanName = rawName.replace(/^['"]|['"]$/g, '').trim();

        // Filter out non-business pagination/limits controls
        if (/^(dpCheckAll|pageSeachValue|dpLimit)$/i.test(cleanName)) continue;

        const labelText = this.findLabelForElement(el);

        // If cleanName is purely digits (e.g. table row index), prefer labelText as key if available
        let key = cleanName;
        if (/^\d+$/.test(cleanName) || !cleanName) {
          key = labelText ? `field_${labelText}` : cleanName;
        }
        if (!key) continue;

        const tagName = el.tagName.toLowerCase();
        let kind: FieldKind = 'text';
        if (tagName === 'select') {
          kind = 'select';
        } else if (el instanceof HTMLInputElement) {
          if (el.type === 'checkbox') kind = 'checkbox';
          else if (el.type === 'number') kind = 'number';
          else if (el.type === 'date' || el.type === 'datetime-local') kind = 'date';
        }

        const group: FieldGroup = this.determineFieldGroup(el);
        const descriptorKey = `${key}__${labelText}`;

        if (!seenKeys.has(descriptorKey)) {
          seenKeys.add(descriptorKey);
          schemas.push({
            key: cleanName || key,
            label: labelText,
            kind,
            group,
            disabled: el.disabled,
            readonly: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.readOnly : false,
            required: el.required,
            placeholder: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : '',
          });
        }
      }

      this.telemetry?.logScan(schemas, 'collectFormSchema');
      return schemas;
    } catch (err) {
      console.warn('[ErpFormDriver] Failed to collect form schema:', err);
      this.telemetry?.logError('SCAN', 'Failed to collect form schema', err);
      return [];
    }
  }

  /**
   * Converts rich FormFieldSchema into legacy visible_fields descriptors
   * for backward compatibility with existing RAG models.
   * e.g. "SupplierName (المورد)"
   */
  buildVisibleFieldsSummary(schemas: FormFieldSchema[]): string[] {
    const list: string[] = [];
    for (const s of schemas) {
      if (s.disabled) continue; // Exclude disabled fields from AI extraction prompts!

      const keyPart = s.key.trim();
      const labelPart = s.label.trim();
      if (labelPart && labelPart !== keyPart) {
        list.push(`${keyPart} (${labelPart})`);
      } else {
        list.push(keyPart);
      }
    }
    return Array.from(new Set(list));
  }

  /**
   * Executes form filling sequentially according to the architecture diamond loop.
   * Delegates to applyProgressiveFill for backward compatibility.
   */
  async applyFormFill(
    fields?: Record<string, any>,
    rows?: Record<string, any>[],
    excludeContainer?: HTMLElement
  ): Promise<FormFillExecutionReport> {
    return this.applyProgressiveFill(fields, rows, excludeContainer);
  }

  /**
   * Progressive Form Fill loop:
   * 1. Fills currently ready & visible fields.
   * 2. After each fill action, calls settle() to wait for dependent DOM rendering.
   * 3. Scans for newly revealed fields and queries AI (/v1/erp/form-fill/resolve-leftover)
   *    to populate values from previously extracted user intent.
   * 4. Repeats until all fields settle or max passes (8) reached.
   */
  async applyProgressiveFill(
    fields?: Record<string, any>,
    rows?: Record<string, any>[],
    excludeContainer?: HTMLElement,
    copilotService?: any,
    userMessage?: string
  ): Promise<FormFillExecutionReport> {
    const results: FormFillResult[] = [];
    let filledCount = 0;

    if (!fields && (!rows || rows.length === 0)) {
      return { success: true, fieldsProcessed: 0, filledCount: 0, results: [] };
    }

    const pendingFields: Record<string, any> = { ...(fields || {}) };
    const filledFields: Record<string, any> = {};
    const maxPasses = 8;
    let pass = 0;

    while (pass < maxPasses) {
      pass++;
      const currentSchema = this.collectFormSchema(excludeContainer);
      const readyKeys = Object.keys(pendingFields).filter((k) => {
        if (String(pendingFields[k]).toUpperCase() === '$TOTAL' || String(pendingFields[k]).toUpperCase() === 'TOTAL') {
          return false;
        }
        const schemaField = currentSchema.find(
          (s) => s.key === k || normalizeArabicText(s.label) === normalizeArabicText(k)
        );
        return schemaField && !schemaField.disabled;
      });

      // Sort readyKeys by DOM appearance in currentSchema to respect natural top-to-bottom cascade
      readyKeys.sort((a, b) => {
        const idxA = currentSchema.findIndex(s => s.key === a || normalizeArabicText(s.label) === normalizeArabicText(a));
        const idxB = currentSchema.findIndex(s => s.key === b || normalizeArabicText(s.label) === normalizeArabicText(b));
        return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
      });

      if (readyKeys.length === 0) {
        // Check if there are newly revealed fields we don't have values for yet
        if (copilotService && userMessage && Object.keys(filledFields).length > 0) {
          const newUnmappedFields = currentSchema
            .filter((s) => !s.disabled && !filledFields[s.key] && !pendingFields[s.key])
            .map(
              (s): FieldSignatureIn => ({
                key: s.key,
                label: s.label,
                kind: s.kind,
                disabled: s.disabled,
                options: s.options,
              })
            );

          if (newUnmappedFields.length > 0) {
            try {
              const leftoverRes: LeftoverResponse = await copilotService.resolveErpLeftover({
                user_message: userMessage,
                extracted_data: fields || {},
                filled: filledFields,
                new_fields: newUnmappedFields,
              });

              if (leftoverRes && leftoverRes.fields && Object.keys(leftoverRes.fields).length > 0) {
                Object.assign(pendingFields, leftoverRes.fields);
                continue; // Re-run pass with newly resolved fields!
              }
            } catch (err) {
              console.warn('[ProgressiveFill] leftover resolution error', err);
            }
          }
        }
        break; // No more fields to process in this pass
      }

      // Process ready fields in this pass
      for (const rawKey of readyKeys) {
        const rawVal = pendingFields[rawKey];
        if (rawVal == null) {
          delete pendingFields[rawKey];
          continue;
        }

        const cleanKey = rawKey.split('(')[0].trim().replace(/^['"]|['"]$/g, '');
        const targetElement = this.findTargetElement(cleanKey, excludeContainer);

        if (!targetElement) {
          if (pass >= maxPasses) {
            delete pendingFields[rawKey];
            this.telemetry?.logFill(cleanKey, 'not_found', 'لم يتم العثور على الحقل في الشاشة', rawVal);
            results.push({
              field: cleanKey,
              value: rawVal,
              status: 'not_found',
              message: 'لم يتم العثور على الحقل في الشاشة',
            });
          }
          continue;
        }

        if (this.isElementDisabled(targetElement)) {
          // Defer disabled fields: only drop if we exhausted all passes
          if (pass >= maxPasses) {
            delete pendingFields[rawKey];
            this.telemetry?.logFill(cleanKey, 'skipped_disabled', 'حقل للقراءة فقط/معطل — يتم ملؤه تلقائياً بواسطة النظام', rawVal);
            results.push({
              field: cleanKey,
              value: rawVal,
              status: 'skipped_disabled',
              message: 'حقل للقراءة فقط/معطل — يتم ملؤه تلقائياً بواسطة النظام',
            });
          }
          continue;
        }

        delete pendingFields[rawKey];

        const tagName = targetElement.tagName.toLowerCase();
        let status: 'filled' | 'ambiguous' | 'not_found' = 'filled';

        if (tagName === 'eg-select' || tagName === 'ng-select') {
          status = await this.setNgSelect(targetElement, rawVal);
        } else if (tagName === 'select') {
          const ok = this.setNativeSelect(targetElement as HTMLSelectElement, rawVal);
          status = ok ? 'filled' : 'not_found';
        } else if (targetElement instanceof HTMLInputElement && targetElement.type === 'checkbox') {
          const checked = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1';
          if (targetElement.checked !== checked) {
            targetElement.click();
          }
          status = 'filled';
        } else if (
          targetElement instanceof HTMLInputElement ||
          targetElement instanceof HTMLTextAreaElement
        ) {
          this.setTextOrDate(targetElement, rawVal);
          status = 'filled';
        }

        if (status === 'filled') {
          filledCount++;
          filledFields[cleanKey] = rawVal;
          this.telemetry?.logFill(cleanKey, 'filled', 'تم إدخال القيمة بنجاح', rawVal);
          results.push({
            field: cleanKey,
            value: rawVal,
            status: 'filled',
            message: 'تم إدخال القيمة بنجاح',
          });
          // Quiesce/settle DOM after each successful input to trigger dependent reactive fields
          await this.settle(
            (targetElement.closest('form, app-base, .erp-card, [data-screen-content]') as HTMLElement) || undefined,
            { quietMs: 60, maxMs: 500 }
          );
          if (this.bridge?.isAvailable) {
            await this.waitFor(() => !this.bridge?.isPageBusy(), 2500);
          }
        } else {
          this.telemetry?.logFill(cleanKey, status, status === 'ambiguous' ? 'الخيار غامض' : 'لم يتم العثور على العنصر', rawVal);
          results.push({
            field: cleanKey,
            value: rawVal,
            status,
            message: status === 'ambiguous' ? 'الخيار غامض' : 'لم يتم العثور على العنصر',
          });
        }
      }
    }

    // ──────────────────────────────────────────────
    // 2. Fill Grid Rows (Items Table)
    // ──────────────────────────────────────────────
    if (rows && rows.length > 0) {
      const rowFilledCount = await this.fillGridRows(rows, excludeContainer, results);
      filledCount += rowFilledCount;
      this.telemetry?.log('GRID', `Completed filling grid rows: ${rowFilledCount}/${rows.length} rows filled`, { total: rows.length, filled: rowFilledCount });
      await this.settle(undefined, { quietMs: 60, maxMs: 400 });
    }

    // ──────────────────────────────────────────────
    // 3. Handle Payment Field with $TOTAL (Footer)
    // ──────────────────────────────────────────────
    if (fields) {
      for (const [rawKey, rawVal] of Object.entries(fields)) {
        if (String(rawVal).toUpperCase() === '$TOTAL' || String(rawVal).toUpperCase() === 'TOTAL') {
          const cleanKey = rawKey.split('(')[0].trim().replace(/^['"]|['"]$/g, '');
          let targetElement = this.findTargetElement(cleanKey, excludeContainer);

          // If targetElement is not a text/number input (e.g. an ng-select like SafeAccounId), discard it so fallbacks find the real payment input
          if (
            targetElement &&
            !(targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement)
          ) {
            targetElement = null;
          }

          // Fallback 1: Search for paid / cash / settlement inputs in the form
          if (!targetElement) {
            const paidSelectors = [
              'input[name*="paid" i]',
              'input[id*="paid" i]',
              'input[formcontrolname*="paid" i]',
              'input[name*="cash" i]',
              'input[id*="cash" i]',
              'input[formcontrolname*="cash" i]',
              'input[name*="pay" i]',
              'input[id*="pay" i]',
              'input[formcontrolname*="pay" i]',
              'input[name*="madfou" i]',
              'input[id*="madfou" i]'
            ];
            for (const sel of paidSelectors) {
              const el = this.getActiveFormRoot().querySelector(sel) as HTMLInputElement;
              if (el && (!excludeContainer || !excludeContainer.contains(el)) && !el.disabled && !el.readOnly) {
                targetElement = el;
                break;
              }
            }
          }

          // Fallback 2: Search by label containing "مدفوع" or "مسدد" or "نقدا"
          if (!targetElement) {
            const labels = Array.from(this.getActiveFormRoot().querySelectorAll('label'));
            for (const lbl of labels) {
              const text = normalizeArabicText(lbl.textContent || '');
              if (text.includes('مدفوع') || text.includes('مسدد') || text.includes('نقدا') || text.includes('سداد')) {
                const group = lbl.closest('.form-group, .row, div');
                const inp = group?.querySelector('input') as HTMLInputElement;
                if (inp && (!excludeContainer || !excludeContainer.contains(inp)) && !inp.disabled && !inp.readOnly) {
                  targetElement = inp;
                  break;
                }
              }
            }
          }

          if (
            targetElement &&
            (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement)
          ) {
            let finalVal = this.readCalculatedTotal();
            if (!finalVal || finalVal === '0') {
              // Calculate fallback sum from rows: sum(qty * price/cost)
              let sum = 0;
              for (const r of rows || []) {
                const q = parseFloat(String(r['الكمية'] || r['كمية'] || r['qty'] || 0)) || 0;
                const p = parseFloat(String(r['السعر'] || r['سعر'] || r['التكلفة'] || r['تكلفة'] || r['price'] || r['cost'] || 0)) || 0;
                sum += (q * p);
              }
              if (sum > 0) {
                finalVal = String(sum);
              } else {
                finalVal = finalVal || '0';
              }
            }
            this.setTextOrDate(targetElement, finalVal);
            filledCount++;
            results.push({
              field: cleanKey || 'المدفوع نقداً',
              value: finalVal,
              status: 'filled',
              message: `تم نسخ القيمة الإجمالية المحسوبة (${finalVal}) إلى خانة السداد والمدفوع نقداً`,
            });
            this.telemetry?.log('FILL', `Populated calculated total (${finalVal}) into cash paid field`, {
              field: cleanKey,
              total: finalVal,
              targetId: targetElement.id || targetElement.getAttribute('name')
            });
          }
        }
      }
    }

    return {
      success: filledCount > 0,
      fieldsProcessed: results.length,
      filledCount,
      results,
    };
  }

  /**
   * Sets value on @ng-select/ng-select component with typeahead support.
   */
  async setNgSelect(
    hostEl: HTMLElement,
    searchTerm: any
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
        const panel = await this.waitFor<HTMLElement>(() => {
          const panels = Array.from(document.querySelectorAll('body > ng-dropdown-panel, ng-dropdown-panel, .ng-dropdown-panel')) as HTMLElement[];
          const visiblePanels = panels.filter(p => !p.hasAttribute('hidden') && p.style.display !== 'none' && (p.offsetWidth > 0 || p.offsetHeight > 0));
          return visiblePanels.length > 0 ? visiblePanels[visiblePanels.length - 1] : (panels[panels.length - 1] || null);
        }, 2000);

        if (!panel) {
          console.warn('[ErpFormDriver] ng-dropdown-panel not found for ng-select');
          return 'not_found';
        }

        // Wait for spinner / loading indicator to disappear first if present
        await this.waitFor<boolean>(() => {
          const loadingEl = panel.querySelector('.ng-spinner-loader, .ng-load-more, .loading');
          return !loadingEl;
        }, 2500);

        // 4. Wait for .ng-option items to render (expanded to 3000ms for slow remote APIs)
        const options = await this.waitFor<HTMLElement[]>(() => {
          const items = (Array.from(panel.querySelectorAll('.ng-option')) as HTMLElement[])
            .filter(o => !o.classList.contains('ng-option-disabled'));
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
          const cleanedOptText = optText.replace(/^[0-9\-_[\]#\s.:]+/, '').replace(/[0-9\-_[\]#\s.:]+$/, '').trim();

          if (optText === normalizedTarget || cleanedOptText === normalizedTarget) {
            exactMatch = opt;
            break;
          }

          if (cleanedOptText.includes(normalizedTarget) || optText.includes(normalizedTarget)) {
            const lengthDiff = Math.abs(cleanedOptText.length - normalizedTarget.length);
            candidateMatches.push({ el: opt, score: 100 - lengthDiff, optText });
          } else {
            const targetWords = normalizedTarget.split(/\s+/).filter(w => w.length > 1);
            let matchedWords = 0;
            for (const tw of targetWords) {
              if (cleanedOptText.includes(tw)) matchedWords++;
            }
            if (matchedWords >= 2 || (targetWords.length === 1 && matchedWords === 1)) {
              candidateMatches.push({
                el: opt,
                score: (matchedWords / targetWords.length) * 50 - Math.abs(cleanedOptText.length - normalizedTarget.length),
                optText
              });
            }
          }
        }

        candidateMatches.sort((a, b) => b.score - a.score);
        const matchToClick = exactMatch || (candidateMatches.length > 0 ? candidateMatches[0].el : null);

        if (matchToClick) {
          matchToClick.click();
          this.highlightElement(ngSelect);
          const elapsedMs = Date.now() - startTime;

          // S6: Verify .ng-value-label rendered
          setTimeout(() => {
            const valueLabel = ngSelect.querySelector('.ng-value-label, .ng-value');
            if (!valueLabel || !valueLabel.textContent?.trim()) {
              this.telemetry?.log(
                'FILL',
                'verify_mismatch on ng-select',
                {
                  term,
                  elementId: ngSelect.id || ngSelect.getAttribute('name'),
                  reason: 'No .ng-value-label rendered after option selection'
                },
                'WARN'
              );
            }
          }, 80);

          this.telemetry?.log('FILL', `ng-select matched option for '${term}'`, {
            term,
            optionsCount,
            elapsedMs,
            selected: (matchToClick.textContent || '').trim()
          });
          return 'filled';
        }

        return 'not_found';
      };

      let result = await performSearch(termStr);

      // If not found and search term contains multiple words, retry once with the first primary word
      if (result === 'not_found') {
        const words = termStr.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 1) {
          const firstWord = words[0];
          console.info(`[ErpFormDriver] Retrying ng-select with first word: "${firstWord}"`);
          result = await performSearch(firstWord);
        }
      }

      // If still not found or ambiguous, hit Escape to close the hanging dropdown panel cleanly
      if (result !== 'filled') {
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
        const elapsedMs = Date.now() - startTime;
        this.telemetry?.log('FILL', `ng-select failed for '${termStr}' (${result})`, {
          term: termStr,
          result,
          elapsedMs
        }, 'WARN');
      }

      return result;
    } catch (err) {
      console.warn('[ErpFormDriver] Error in setNgSelect:', err);
      this.telemetry?.logError('FILL', 'setNgSelect error', err);
      return 'not_found';
    }
  }

  /**
   * Sets value on native <select> matching by value or visible text.
   */
  setNativeSelect(selectEl: HTMLSelectElement, val: any): boolean {
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
    this.highlightElement(selectEl);
    return true;
  }

  /**
   * Sets text/date/number input using prototype setter to ensure Angular Reactive Forms detect change.
   */
  setTextOrDate(el: HTMLInputElement | HTMLTextAreaElement, val: any): void {
    try {
      el.focus();
    } catch {
      // ignore focus error
    }

    const prototype =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) {
      setter.call(el, String(val));
    } else {
      el.value = String(val);
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));

    // S6: Verification check
    const expectedStr = String(val).trim();
    const actualStr = (el.value || '').trim();
    if (actualStr !== expectedStr && !actualStr.includes(expectedStr)) {
      // Retry once with simulated key events
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true }));
      if (setter) {
        setter.call(el, String(val));
      } else {
        el.value = String(val);
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Unidentified', bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      const finalStr = (el.value || '').trim();
      if (finalStr !== expectedStr && !finalStr.includes(expectedStr)) {
        this.telemetry?.log(
          'FILL',
          'verify_mismatch on input',
          {
            elementId: el.id || el.getAttribute('name') || el.getAttribute('placeholder'),
            expected: expectedStr,
            actual: finalStr
          },
          'WARN'
        );
      }
    }

    this.highlightElement(el);
  }

  /**
   * Reads calculated total or net invoice amount from DOM fields.
   */
  readCalculatedTotal(): string | null {
    if (typeof document === 'undefined') return null;

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
      const el = this.getActiveFormRoot().querySelector(sel) as HTMLInputElement;
      if (el && el.value && el.value.trim()) {
        const num = el.value.trim().replace(/,/g, '');
        if (!isNaN(Number(num)) && Number(num) > 0) return num;
      }
    }

    // Try finding label with "إجمالي" or "صافي"
    const labels = Array.from(this.getActiveFormRoot().querySelectorAll('label'));
    for (const lbl of labels) {
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
      this.getActiveFormRoot().querySelectorAll('tfoot td, .total-value, .net-value, [class*="total"]')
    ) as HTMLElement[];
    for (const cell of footerCells) {
      const text = cell.textContent?.trim().replace(/,/g, '').replace(/[^\d.]/g, '') || '';
      if (text && !isNaN(Number(text)) && Number(text) > 0) {
        return text;
      }
    }

    return null;
  }

  /**
   * Resilient target element finder:
   * 1. Matches by name, id, data-testid, placeholder (ignoring surrounding quotes)
   * 2. Matches by Arabic label association
   */
  findTargetElement(key: string, excludeContainer?: HTMLElement): HTMLElement | null {
    if (typeof document === 'undefined' || !key) return null;

    const clean = key.trim().replace(/^['"]|['"]$/g, '');
    const formRoot = this.getActiveFormRoot();

    // Map known aliases (e.g. POSetting <-> طريقة الشراء, StoreID <-> المخزن, ProjectID <-> المشروع)
    const aliasMap: Record<string, string[]> = {
      'supplierid': ['supplier', 'vendor', 'المورد', 'مورد'],
      'storeid': ['store', 'warehouse', 'المخزن', 'مخزن'],
      'safeaccounid': ['safe', 'cashbox', 'treasury', 'الخزينة', 'خزينة', 'الصندوق', 'صندوق', 'طريقة الدفع', 'طريقة السداد'],
      'projectid': ['project', 'المشروع', 'مشروع', 'المشروعات', 'مشروعات'],
      'posetting': ['posetting', 'purchasesetting', 'طريقة الشراء', 'طريقةالشراء', 'نوع الشراء', 'اعدادات الشراء'],
      'costitemid': ['costitem', 'costcenter', 'مركز التكلفة', 'مركزالتكلفة'],
      'cashpaid': ['paid', 'cash', 'paidamount', 'netpaid', 'المدفوع', 'مدفوع', 'المسدد', 'مسدد', 'المدفوع نقدا', 'مدفوع نقدا', 'نقدا']
    };

    const keysToTry = [clean];
    const cleanLower = clean.toLowerCase();
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      if (cleanLower === canonical || aliases.includes(clean) || aliases.includes(cleanLower)) {
        if (!keysToTry.includes(canonical)) keysToTry.push(canonical);
        for (const al of aliases) {
          if (!keysToTry.includes(al)) keysToTry.push(al);
        }
      }
    }

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
        `[data-field="${searchKey}" i]`
      ].join(', ');

      const customCandidates = Array.from(formRoot.querySelectorAll(customSelector)) as HTMLElement[];
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
        `[data-field="${searchKey}" i]`
      ].join(', ');

      const elements = Array.from(formRoot.querySelectorAll(safeSelector)) as HTMLElement[];
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
      if (lblText && (lblText === normalizedKey || lblText.includes(normalizedKey) || normalizedKey.includes(lblText))) {
        const group = lbl.closest('.form-group, .row, .field-wrapper, div');
        if (group) {
          const target = group.querySelector('eg-select, ng-select, select, input, textarea') as HTMLElement;
          if (target && (!excludeContainer || !excludeContainer.contains(target))) {
            return target;
          }
        }
      }
    }

    return null;
  }

  private findLabelForElement(el: HTMLElement): string {
    // 1. Explicit <label for="element_id">
    if (el.id) {
      try {
        const explicitLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (explicitLabel && explicitLabel.textContent) {
          const text = explicitLabel.textContent.trim().replace(/[:*]/g, '').trim();
          if (text) return text;
        }
      } catch {
        // ignore selector syntax errors
      }
    }

    // 2. aria-label or aria-labelledby
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel.trim().replace(/[:*]/g, '').trim();
    }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const refEl = document.getElementById(labelledBy);
      if (refEl && refEl.textContent) {
        const text = refEl.textContent.trim().replace(/[:*]/g, '').trim();
        if (text) return text;
      }
    }

    // 3. Closest parent form-group or column container (STRICT: exclude .row to avoid pulling sibling field labels)
    const parentGroup = el.closest(
      '.form-group, .field-wrapper, .form-field, mat-form-field, [class*="col-"], label'
    );
    if (parentGroup) {
      const labelEl =
        parentGroup.tagName === 'LABEL'
          ? (parentGroup as HTMLElement)
          : (parentGroup.querySelector('label, mat-label') as HTMLElement);
      if (labelEl && labelEl !== el && labelEl.textContent) {
        const text = labelEl.textContent.trim().replace(/[:*]/g, '').trim();
        if (text) return text;
      }
    }

    // 4. Table cell -> Match corresponding <th> / columnheader by column index
    const cell = el.closest('td, mat-cell, [role="gridcell"]');
    if (cell) {
      const row = cell.closest('tr, mat-row, [role="row"]');
      const table = cell.closest('table, mat-table, ag-grid, [role="grid"]');
      if (row && table) {
        const cells = Array.from(row.children);
        const colIndex = cells.indexOf(cell);
        if (colIndex >= 0) {
          const headers = Array.from(
            table.querySelectorAll('thead th, mat-header-cell, [role="columnheader"]')
          ) as HTMLElement[];
          if (headers[colIndex] && headers[colIndex].textContent) {
            const thText = headers[colIndex].textContent.trim().replace(/[:*]/g, '').trim();
            if (thText) return thText;
          }
        }
      }
    }

    // 5. Fallback to placeholder or title
    const placeholder = el.getAttribute('placeholder') || el.getAttribute('title');
    if (placeholder && placeholder.trim()) {
      return placeholder.trim().replace(/[:*]/g, '').trim();
    }

    return '';
  }

  private determineFieldGroup(el: HTMLElement): FieldGroup {
    if (el.closest('table, tbody, thead, mat-table, ag-grid')) return 'grid';
    if (el.closest('.footer, .invoice-footer, .totals-section, .actions-bar')) return 'footer';
    return 'header';
  }

  private isElementDisabled(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.disabled || el.readOnly;
    }
    if (el instanceof HTMLSelectElement) {
      return el.disabled;
    }
    return el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
  }

  private highlightElement(el: HTMLElement): void {
    el.classList.add('ai-autofill-highlight');
    setTimeout(() => el.classList.remove('ai-autofill-highlight'), 3500);
  }

  /**
   * Fills items grid table rows sequentially.
   * Matches column headers from <th> / mat-header-cell, finds or creates row,
   * and populates item, quantity, cost/price, and unit cells.
   */
  async fillGridRows(
    rows: Record<string, any>[],
    excludeContainer?: HTMLElement,
    resultsOut?: FormFillResult[]
  ): Promise<number> {
    if (typeof document === 'undefined' || !rows || rows.length === 0) return 0;

    let filledRowsCount = 0;
    try {
      const tables = Array.from(
        this.getActiveFormRoot().querySelectorAll('table, mat-table, ag-grid, [role="grid"]')
      ) as HTMLElement[];

      // Pick the table that specifically contains items/products or fallback to the first table
      const table =
        tables.find((t) => {
          if (excludeContainer && excludeContainer.contains(t)) return false;
          const text = (t.textContent || '').toLowerCase();
          return (
            text.includes('صنف') ||
            text.includes('منتج') ||
            text.includes('كمية') ||
            text.includes('item') ||
            text.includes('qty')
          );
        }) || tables.find((t) => !excludeContainer || !excludeContainer.contains(t));

      if (!table) {
        console.warn('[ErpFormDriver] No grid table found for rows filling');
        return 0;
      }

      // Read clean column headers strictly from the primary header row (thead tr)
      const thead = table.querySelector('thead');
      const headerRow = thead ? thead.querySelector('tr') : table.querySelector('tr');
      const headers = headerRow
        ? (Array.from(headerRow.querySelectorAll('th, td, [role="columnheader"]')) as HTMLElement[])
        : (Array.from(table.querySelectorAll('thead th, mat-header-cell, [role="columnheader"]')) as HTMLElement[]);

      const colHeaderMap: { index: number; text: string }[] = headers.map((th, index) => ({
        index,
        text: normalizeArabicText(th.textContent || ''),
      }));

      const isGenuineItemRow = (r: HTMLElement): boolean => {
        if (r.closest('thead, tfoot')) return false;
        if (r.querySelector('th, [role="columnheader"]')) return false;

        const className = (r.className || '').toLowerCase();
        if (
          className.includes('filter') ||
          className.includes('p-filter-row') ||
          className.includes('no-data') ||
          className.includes('empty') ||
          className.includes('template') ||
          className.includes('dub') ||
          r.querySelector('.no-data-msg, .dataTables_empty')
        ) {
          return false;
        }

        // Exclude template or duplicate rows where all dropdowns are 'Dub'
        const selects = Array.from(r.querySelectorAll('eg-select, ng-select, mat-select')) as HTMLElement[];
        if (selects.length > 0) {
          const onlyDub = selects.every((s) => {
            const name = (s.getAttribute('name') || s.getAttribute('formcontrolname') || s.id || '').toLowerCase();
            const label = (s.getAttribute('aria-label') || s.getAttribute('title') || '').toLowerCase();
            return name.includes('dub') || label.includes('dub');
          });
          if (onlyDub) return false;
          return true;
        }

        const inputs = Array.from(
          r.querySelectorAll('input:not([type="hidden"]), select')
        ) as (HTMLInputElement | HTMLSelectElement)[];
        const editableInputs = inputs.filter((inp) => !inp.disabled && !(inp instanceof HTMLInputElement && inp.readOnly));
        return editableInputs.length >= 2;
      };

      const getGenuineRows = (): HTMLElement[] => {
        const rowsInTbody = Array.from(table.querySelectorAll('tbody > tr, mat-row')) as HTMLElement[];
        const candidates =
          rowsInTbody.length > 0
            ? rowsInTbody
            : (Array.from(table.querySelectorAll('tr, mat-row, [role="row"]')) as HTMLElement[]).filter(
                (r) => !r.closest('thead, tfoot')
              );
        return candidates.filter(isGenuineItemRow);
      };

      const matchesColKey = (headerText: string, key: string): boolean => {
        const normHeader = normalizeArabicText(headerText).replace(/\s+/g, '');
        const normKey = normalizeArabicText(key).replace(/\s+/g, '');

        if (normHeader.includes(normKey) || normKey.includes(normHeader)) return true;

        const synonymGroups: string[][] = [
          ['اسمالمنتج', 'الصنف', 'المنتج', 'البيان', 'البند', 'item', 'product', 'itemname', 'productname'],
          ['الكمية', 'العدد', 'كمية', 'qty', 'quantity', 'count'],
          ['السعر', 'التكلفة', 'سعرالشراء', 'سعرالوحدة', 'سعر', 'تكلفة', 'price', 'cost', 'unitprice', 'purchasingprice'],
          ['الوحدة', 'وحدةالقياس', 'وحدة', 'unit'],
          ['الملاحظات', 'ملاحظات', 'بيان', 'notes', 'remarks'],
          ['الاجمالي', 'اجمالي', 'القيمة', 'total', 'amount']
        ];

        for (const group of synonymGroups) {
          const keyInGroup = group.some((g) => normKey.includes(g) || g.includes(normKey));
          if (keyInGroup) {
            const headerInGroup = group.some((g) => normHeader.includes(g) || g.includes(normHeader));
            if (headerInGroup) return true;
          }
        }
        return false;
      };

      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const rowData = rows[rIdx];

        let rowEls = getGenuineRows();
        let targetRow: HTMLElement | null | undefined = rowEls[rIdx];

        if (!targetRow) {
          const addBtn = await this.findAddRowButton(table, excludeContainer);
          if (addBtn) {
            addBtn.click();
            targetRow = (await this.waitFor<HTMLElement>(() => {
              const currentRows = getGenuineRows();
              if (currentRows.length > rowEls.length) {
                return currentRows[rIdx] || currentRows[currentRows.length - 1] || null;
              }
              return null;
            }, 3000)) || undefined;

            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        // If targetRow exists but lacks an item selector dropdown, trigger addBtn to get a proper item row
        if (targetRow && !targetRow.querySelector('eg-select, ng-select')) {
          const addBtn = await this.findAddRowButton(table, excludeContainer);
          if (addBtn) {
            addBtn.click();
            targetRow = (await this.waitFor<HTMLElement>(() => {
              const currentRows = getGenuineRows();
              const candidate = currentRows[rIdx] || currentRows[currentRows.length - 1];
              return candidate && candidate.querySelector('eg-select, ng-select') ? candidate : null;
            }, 3000)) || targetRow;

            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        if (!targetRow) {
          console.warn(`[ErpFormDriver] Could not find or create grid row index ${rIdx}`);
          this.telemetry?.log('GRID', `Could not find or create grid row index ${rIdx}`, {
            row: rIdx + 1,
            data: rowData
          });
          continue;
        }

        const cells = Array.from(targetRow.querySelectorAll('td, mat-cell, [role="gridcell"]')) as HTMLElement[];
        let cellFilled = false;

        // Sort entries so product/item dropdown is filled FIRST, allowing ERP async cascade to settle before setting qty/cost
        const sortedEntries = Object.entries(rowData).sort(([keyA], [keyB]) => {
          const isItemA = matchesColKey('الصنف', keyA) || matchesColKey('اسم المنتج', keyA);
          const isItemB = matchesColKey('الصنف', keyB) || matchesColKey('اسم المنتج', keyB);
          if (isItemA && !isItemB) return -1;
          if (!isItemA && isItemB) return 1;
          return 0;
        });

        for (const [colKey, rawVal] of sortedEntries) {
          if (rawVal == null) continue;

          let targetCell: HTMLElement | null = null;
          for (let cIdx = 0; cIdx < cells.length; cIdx++) {
            const h = colHeaderMap.find((header) => header.index === cIdx);
            if (h && matchesColKey(h.text, colKey)) {
              targetCell = cells[cIdx];
              break;
            }
          }

          if (!targetCell) {
            for (const cell of cells) {
              const input = cell.querySelector(
                `input[name*="${colKey}" i], select[name*="${colKey}" i], textarea[name*="${colKey}" i], [data-field*="${colKey}" i]`
              );
              if (input) {
                targetCell = cell;
                break;
              }
            }
          }

          // Direct Fallback 1: match product/item column directly to cell with eg-select / ng-select (excluding Dub)
          if (!targetCell && (matchesColKey('الصنف', colKey) || matchesColKey('اسم المنتج', colKey))) {
            targetCell =
              cells.find((c) => {
                const sel = c.querySelector('eg-select, ng-select');
                if (!sel) return false;
                const name = (sel.getAttribute('name') || sel.getAttribute('formcontrolname') || sel.id || '').toLowerCase();
                return !name.includes('dub');
              }) || null;
          }

          // Direct Fallback 2: match quantity directly to number input cell
          if (!targetCell && (matchesColKey('الكمية', colKey) || matchesColKey('العدد', colKey))) {
            targetCell =
              cells.find((c) => {
                const inp = c.querySelector(
                  'input[type="number"], input[name*="qty" i], input[name*="count" i], input[formcontrolname*="qty" i]'
                );
                return !!inp;
              }) || null;
          }

          // Direct Fallback 3: match price/cost directly to price/cost input cell
          if (!targetCell && (matchesColKey('السعر', colKey) || matchesColKey('التكلفة', colKey))) {
            targetCell =
              cells.find((c) => {
                const inp = c.querySelector(
                  'input[name*="price" i], input[name*="cost" i], input[formcontrolname*="price" i], input[formcontrolname*="cost" i]'
                );
                return !!inp;
              }) || null;
          }

          if (targetCell) {
            const ngSelect = targetCell.querySelector('eg-select, ng-select') as HTMLElement;
            if (ngSelect) {
              const status = await this.setNgSelect(ngSelect, rawVal);
              if (status === 'filled') {
                cellFilled = true;
                // Wait briefly for ERP cascade / auto-calculated fields to populate
                await this.settle(targetRow, { quietMs: 60, maxMs: 400 });
              }
            } else {
              const input = targetCell.querySelector('input, select, textarea') as
                | HTMLInputElement
                | HTMLSelectElement
                | HTMLTextAreaElement;

              if (input && !input.disabled && !(input as HTMLInputElement).readOnly) {
                // P3: Check if this is a Price/Cost column that already received an auto-populated default value from the ERP system
                const isCostOrPrice = matchesColKey('التكلفة', colKey) || matchesColKey('السعر', colKey);
                if (isCostOrPrice) {
                  await this.settle(targetRow, { quietMs: 40, maxMs: 200 });
                  const existingNum = parseFloat(String(input.value || '').replace(/,/g, '').trim());
                  if (!isNaN(existingNum) && existingNum > 0) {
                    this.telemetry?.log('GRID', `Preserving system auto-populated default cost for row ${rIdx + 1}`, {
                      field: colKey,
                      systemCost: existingNum,
                      skippedProposed: rawVal
                    });
                    cellFilled = true;
                    continue; // Leave the system default value intact!
                  }
                }

                if (input.tagName.toLowerCase() === 'select') {
                  this.setNativeSelect(input as HTMLSelectElement, rawVal);
                } else {
                  this.setTextOrDate(input as HTMLInputElement, rawVal);
                }
                cellFilled = true;
              }
            }
          }
        }

        // Post-fill verification & enforcement for quantity:
        // DynamicERP's async product selection cascade often resets quantity to default 1.
        // If the user specified an expected quantity, ensure it is preserved!
        const expectedQtyKey = Object.keys(rowData).find(k => matchesColKey('الكمية', k) || matchesColKey('العدد', k) || k.toLowerCase().includes('qty'));
        if (expectedQtyKey && rowData[expectedQtyKey] != null) {
          const expectedQty = parseFloat(String(rowData[expectedQtyKey]));
          if (!isNaN(expectedQty)) {
            const qtyInput = targetRow.querySelector(
              'input[name*="qty" i], input[name*="count" i], input[name*="quantity" i], input[formcontrolname*="qty" i], input[formcontrolname*="quantity" i], input[type="number"]'
            ) as HTMLInputElement;

            if (qtyInput && !qtyInput.disabled && !qtyInput.readOnly) {
              const currentQty = parseFloat(String(qtyInput.value || '').replace(/,/g, '').trim());
              if (isNaN(currentQty) || currentQty !== expectedQty) {
                this.telemetry?.log('GRID', `Enforcing requested quantity for row ${rIdx + 1} after cascade (was ${currentQty}, expected ${expectedQty})`, {
                  row: rIdx + 1,
                  currentQty,
                  expectedQty
                });
                this.setTextOrDate(qtyInput, expectedQty);
                await this.settle(targetRow, { quietMs: 40, maxMs: 200 });
              }
            }
          }
        }

        if (cellFilled) {
          filledRowsCount++;

          // S6: Settle and read calculated total after row is filled
          await this.settle(targetRow, { quietMs: 50, maxMs: 250 });
          const totalAfterRow = this.readCalculatedTotal();
          if (totalAfterRow) {
            this.telemetry?.log('GRID', `Calculated total after filling row ${rIdx + 1}`, {
              row: rIdx + 1,
              calculatedTotal: totalAfterRow
            });
          }

          if (resultsOut) {
            resultsOut.push({
              field: `row_${rIdx + 1}`,
              value: rowData,
              status: 'filled',
              message: `تمت تعبئة سطر الصنف رقم ${rIdx + 1}`,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[ErpFormDriver] Error filling grid rows:', err);
    }
    return filledRowsCount;
  }

  private async findAddRowButton(table: HTMLElement, excludeContainer?: HTMLElement): Promise<HTMLElement | null> {
    // 1. Gather candidates scoped strictly near the table first
    const localCandidates: HTMLElement[] = [];
    let current: HTMLElement | null = table;

    while (current && current !== document.body) {
      const btns = Array.from(
        current.querySelectorAll('button, a.btn, span.btn, [role="button"]')
      ) as HTMLElement[];
      for (const btn of btns) {
        if (!localCandidates.includes(btn)) localCandidates.push(btn);
      }
      if (
        current.classList.contains('erp-table-box') ||
        current.classList.contains('card') ||
        current.tagName.toLowerCase() === 'section' ||
        current.classList.contains('items-grid') ||
        current.classList.contains('table-responsive')
      ) {
        break;
      }
      current = current.parentElement;
    }

    const isValidBtn = (btn: HTMLElement): boolean => {
      if (excludeContainer && excludeContainer.contains(btn)) return false;
      if (!btn.offsetWidth && !btn.offsetHeight && !btn.getClientRects().length) return false;
      return true;
    };

    const matchesAddRowPattern = (btn: HTMLElement): boolean => {
      // Check mat-icon or inner icon elements
      const icons = Array.from(btn.querySelectorAll('mat-icon, i, span, svg')) as HTMLElement[];
      for (const ic of icons) {
        const icText = (ic.textContent || '').trim().toLowerCase();
        const icClass = (ic.className || '').toLowerCase();
        if (
          icText === 'add' ||
          icText === 'add_circle' ||
          icText === 'add_box' ||
          icText === 'plus' ||
          icClass.includes('fa-plus') ||
          icClass.includes('bi-plus') ||
          icClass.includes('icon-plus') ||
          icClass.includes('btn--add')
        ) {
          return true;
        }
      }

      // Check button text
      const btnText = (btn.textContent || '').trim().toLowerCase();
      if (
        btnText === '+' ||
        btnText === 'add' ||
        btnText === 'add row' ||
        btnText === 'إضافة' ||
        btnText === 'اضافة' ||
        btnText === 'إضافة سطر' ||
        btnText === 'اضافة سطر' ||
        btnText === 'سطر جديد' ||
        btnText === '+ إضافة' ||
        btnText === '+ اضافة'
      ) {
        return true;
      }

      // Check data-action
      const dataAction = (btn.getAttribute('data-action') || '').toLowerCase();
      if (dataAction.includes('add') || dataAction.includes('create-row')) {
        return true;
      }

      // Check title / aria-label
      const titleOrAria = (
        (btn.getAttribute('title') || '') + ' ' + (btn.getAttribute('aria-label') || '')
      ).toLowerCase();
      if (
        titleOrAria.includes('add') ||
        titleOrAria.includes('إضافة') ||
        titleOrAria.includes('اضافة') ||
        titleOrAria.includes('سطر') ||
        titleOrAria.includes('+')
      ) {
        return true;
      }

      // Check CSS classes
      const cls = (btn.className || '').toLowerCase();
      if (cls.includes('btn--add') || cls.includes('add-row') || cls.includes('add_row')) {
        return true;
      }

      return false;
    };

    // 2. Structural Resolution FIRST (Zero network roundtrips, sub-millisecond, 0 tokens)
    for (const btn of localCandidates) {
      if (!isValidBtn(btn)) continue;
      if (matchesAddRowPattern(btn)) {
        this.telemetry?.log('GRID', 'Resolved add-row button structurally near grid', {
          action: btn.getAttribute('data-action') || btn.id || btn.className,
          label: (btn.textContent || btn.getAttribute('title') || '').trim()
        });
        return btn;
      }
    }

    // 3. If not found in immediate table container, search broader form container
    const formRoot = (table.closest('.erp-mock-main, .erp-screen, form, main') || document.body) as HTMLElement;
    const formBtns = (
      Array.from(formRoot.querySelectorAll('button, a.btn, span.btn, [role="button"]')) as HTMLElement[]
    ).filter((b) => !localCandidates.includes(b));

    for (const btn of formBtns) {
      if (!isValidBtn(btn)) continue;
      if (matchesAddRowPattern(btn)) {
        this.telemetry?.log('GRID', 'Resolved add-row button structurally in form', {
          action: btn.getAttribute('data-action') || btn.id || btn.className,
          label: (btn.textContent || btn.getAttribute('title') || '').trim()
        });
        return btn;
      }
    }

    // 4. Fallback to AI (resolveErpControls) only if structural pattern found nothing
    const allCandidates = [...localCandidates, ...formBtns].filter(isValidBtn);
    if (this.copilotService && allCandidates.length > 0) {
      try {
        const controlList: ControlIn[] = [];
        const elementMap = new Map<string, HTMLElement>();
        let cIdx = 1;

        // Scoped to top 15 closest candidate buttons to avoid blowing token limit
        for (const btn of allCandidates.slice(0, 15)) {
          const rawText = (btn.textContent || btn.getAttribute('title') || btn.getAttribute('aria-label') || '').trim();
          const id = btn.getAttribute('data-action') || btn.id || `grid_btn_${cIdx++}`;
          controlList.push({ id, label: rawText.slice(0, 80) || id });
          elementMap.set(id, btn);
        }

        const screenId = document.querySelector('.screen-tag code')?.textContent?.trim() || 'CURRENT_SCREEN';
        const res = await this.copilotService.resolveErpControls({
          screen_id: screenId,
          controls: controlList
        });

        const addRowId = res.roles ? res.roles['add_row'] : undefined;
        if (addRowId) {
          const btn = elementMap.get(addRowId);
          if (btn) {
            this.telemetry?.log('GRID', 'Resolved add-row button via AI fallback', { addRowId });
            return btn;
          }
        }
      } catch (err) {
        console.warn('[ErpFormDriver] AI add_row resolution failed:', err);
      }
    }

    return null;
  }
}

