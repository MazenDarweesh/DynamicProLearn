import { Injectable, inject, Injector } from '@angular/core';
import {
  FormFieldSchema,
  FormFillResult,
  FormFillExecutionReport,
  FieldSignatureIn,
  LeftoverResponse,
} from '../../models/erp-form.models';
import { CopilotService } from '../ai-copilot/copilot.service';
import { ErpTelemetryService } from './erp-telemetry.service';
import { ErpBridgeService } from './erp-bridge.service';

// Modular Driver Delegates
import {
  normalizeArabicText,
  convertEasternToWesternNumerals,
} from './form-driver/arabic-normalizer';
import {
  getActiveFormRoot,
  waitFor,
  settle,
  highlightElement,
} from './form-driver/dom-synchronizer';
import {
  collectFormSchema,
  buildVisibleFieldsSummary,
  diffSchemas,
  isElementDisabled,
} from './form-driver/form-inspector';
import {
  findTargetElement,
  setTextOrDate,
  setNativeSelect,
  setNgSelect,
  readCalculatedTotal,
} from './form-driver/control-interactor';
import { fillGridRows } from './form-driver/grid-driver';
import { verifyPostFillAssertions } from './save-recovery/erp-save-verifier';

// Re-export for backward compatibility with components & callers
export { normalizeArabicText, convertEasternToWesternNumerals };

/** Keys that hold lookup IDs/choices in the ERP model: a non-numeric string there is display text, not an ID. */
const LOOKUP_LIKE_KEY = /(id$|setting|type|account|store|project|item|supplier|customer|currancy|currency|safe|salesman|employee|gov|categor)/i;

/** True when `value` can be written straight into the host model without resolving a lookup option. */
export function isSafeBridgeScalar(key: string, value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  const text = String(value).trim();
  if (text === '' || text.startsWith('$')) return false;
  if (LOOKUP_LIKE_KEY.test(key)) return /^-?\d+(\.\d+)?$/.test(text);
  return true;
}

/**
 * ErpFormDriverService - Lean Façade & Form Fill Orchestrator.
 * Coordinates DOM inspection, control interaction, grid automation,
 * and multi-pass progressive form filling with AI fallback.
 */
@Injectable({
  providedIn: 'root',
})
export class ErpFormDriverService {
  private injector = inject(Injector);
  private telemetry = inject(ErpTelemetryService, { optional: true });
  private bridge = inject(ErpBridgeService, { optional: true });

  private get copilotService(): CopilotService | null {
    try {
      return this.injector.get(CopilotService, null);
    } catch {
      return null;
    }
  }

  /**
   * Resolves the live form container so hidden background tabs are never inspected.
   */
  getActiveFormRoot(): ParentNode {
    return getActiveFormRoot();
  }

  /**
   * Waits for a condition to be satisfied using MutationObserver without arbitrary setTimeout.
   */
  async waitFor<T>(
    predicate: () => T | null | undefined,
    timeoutMs: number = 2000
  ): Promise<T | null> {
    return waitFor(predicate, timeoutMs);
  }

  /**
   * Waits for DOM mutations to quiesce (settle) within container, with a safety ceiling.
   */
  async settle(
    container?: HTMLElement,
    options: { quietMs?: number; maxMs?: number; minMs?: number } = {}
  ): Promise<void> {
    return settle(container, options);
  }

  /**
   * Compares two form schemas to identify newly revealed or newly enabled fields.
   */
  diffSchemas(
    before: FormFieldSchema[],
    after: FormFieldSchema[]
  ): { newlyAppeared: FormFieldSchema[]; newlyEnabled: FormFieldSchema[] } {
    return diffSchemas(before, after);
  }

  /**
   * Scans the host ERP DOM to collect a rich schema of form fields.
   */
  collectFormSchema(excludeContainer?: HTMLElement): FormFieldSchema[] {
    return collectFormSchema(excludeContainer, this.telemetry);
  }

  /**
   * Converts rich FormFieldSchema into legacy visible_fields descriptors.
   */
  buildVisibleFieldsSummary(schemas: FormFieldSchema[]): string[] {
    return buildVisibleFieldsSummary(schemas);
  }

  /**
   * Resilient target element finder matching names, ids, formcontrolnames, aliases, or Arabic labels.
   */
  findTargetElement(key: string, excludeContainer?: HTMLElement): HTMLElement | null {
    return findTargetElement(key, excludeContainer);
  }

  /**
   * Sets value on @ng-select/ng-select component with typeahead support.
   */
  async setNgSelect(
    hostEl: HTMLElement,
    searchTerm: any
  ): Promise<'filled' | 'ambiguous' | 'not_found'> {
    return setNgSelect(hostEl, searchTerm, this.telemetry);
  }

  /**
   * Sets value on native <select> matching by value or visible text.
   */
  setNativeSelect(selectEl: HTMLSelectElement, val: any): boolean {
    return setNativeSelect(selectEl, val);
  }

  /**
   * Sets text/date/number input using prototype setter to ensure Angular Reactive Forms detect change.
   */
  setTextOrDate(el: HTMLInputElement | HTMLTextAreaElement, val: any): void {
    setTextOrDate(el, val, this.telemetry);
  }

  /**
   * Reads calculated total or net invoice amount from DOM fields.
   */
  readCalculatedTotal(): string | null {
    return readCalculatedTotal();
  }

  /**
   * Fills items grid table rows sequentially.
   */
  async fillGridRows(
    rows: Record<string, any>[],
    excludeContainer?: HTMLElement,
    resultsOut?: FormFillResult[]
  ): Promise<number> {
    return fillGridRows(rows, {
      excludeContainer,
      resultsOut,
      telemetry: this.telemetry,
      copilotService: this.copilotService,
    });
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
    const activeCopilotService = copilotService || this.copilotService;
    const results: FormFillResult[] = [];
    let filledCount = 0;

    if (!fields && (!rows || rows.length === 0)) {
      return { success: true, fieldsProcessed: 0, filledCount: 0, results: [] };
    }

    const pendingFields: Record<string, any> = { ...(fields || {}) };

    // Auto-default ExchangePrice = 1 for home currency (EGP / default) if not explicitly specified
    const currencyVal = String(
      pendingFields['CurrancyID'] || pendingFields['currency'] || pendingFields['العملة'] || ''
    ).trim().toUpperCase();
    const hasExplicitRate =
      pendingFields['ExchangePrice'] != null ||
      pendingFields['سعر الصرف'] != null ||
      pendingFields['exchangeprice'] != null;

    if (!hasExplicitRate && (currencyVal === 'EGP' || currencyVal === '1' || currencyVal === '')) {
      // Always inject ExchangePrice=1 for home currency — DOM schema discovery is unreliable
      // when the input[type="number"] has no name/id/formcontrolname (Purchases screen pattern).
      pendingFields['ExchangePrice'] = 1;
    }

    // Priority 0: Clean Host Bridge (Direct In-Memory State Binding across excelObject / dataObject)
    if (this.bridge?.isAvailable) {
      try {
        const activeCtx = this.bridge.getActiveFormContext();
        const hasExistingRows =
          Array.isArray(activeCtx?.rows) &&
          activeCtx.rows.some(
            (r: any) =>
              r &&
              (r.ProductID ||
                r.ItemId ||
                r.Total > 0 ||
                r.Qty > 0 ||
                r.UnitePrice > 0 ||
                r.PriceCurrancy > 0)
          );

        const lookupKinds = new Set(['ng-select', 'select', 'mat-select']);
        const liveSchema = this.collectFormSchema(excludeContainer);
        const lookupKeys = new Set(liveSchema.filter((s) => lookupKinds.has(s.kind)).map((s) => s.key));
        // Never push display text into lookup/ID model properties: the host would persist the raw string
        // (e.g. StoreID:"مخزن خامات") and the server fails with "Incorrect syntax near ...".
        // With an unknown/empty schema we cannot tell lookups apart, so nothing is forwarded to the bridge
        // and the DOM driver (which resolves real option IDs) handles every field.
        const bridgeFields =
          liveSchema.length === 0
            ? {}
            : Object.fromEntries(
                Object.entries(pendingFields).filter(
                  ([k, v]) => !lookupKeys.has(k) && isSafeBridgeScalar(k, v)
                )
              );
        if (pendingFields['ExchangePrice'] != null && bridgeFields['ExchangePrice'] == null) {
          bridgeFields['ExchangePrice'] = Number(pendingFields['ExchangePrice']) || 1;
        }

        // Only pass rows to in-memory bridge if they already carry resolved numeric ProductID / ItemId;
        // otherwise let fillGridRows add them via the DOM product picker so Angular resolves ProductID & price!
        const preResolvedRows = hasExistingRows
          ? []
          : (rows || []).filter((r: any) => r && (r.ProductID != null || r.ItemId != null));

        await this.bridge.fillFormData({
          fields: bridgeFields,
          rows: preResolvedRows
        });

        // Direct DOM write for ExchangePrice — bridge memory alone is NOT sufficient:
        // Angular reactive forms only detect changes via native input/change DOM events.
        // Even if ExchangePrice exists in dataObject, ERP server ignores it without the event.
        if (pendingFields['ExchangePrice'] != null) {
          const rate = Number(pendingFields['ExchangePrice']) || 1;
          const exchEl = this.writeExchangePriceDom(excludeContainer, rate);
          this.telemetry?.log(
            'FILL',
            exchEl
              ? `ExchangePrice DOM write succeeded (${rate}) — Angular event dispatched`
              : `ExchangePrice DOM write: element not found in DOM (rate=${rate})`,
            { rate, found: !!exchEl }
          );
        }

        const fieldKeys = Object.keys(fields || {});
        this.telemetry?.log(
          'FILL',
          `Direct bridge fillFormData synchronized in memory (${fieldKeys.length} fields, ${preResolvedRows.length} pre-resolved rows)`,
          { fields: bridgeFields, rows: preResolvedRows, hasExistingRows }
        );
      } catch (err) {
        console.warn('[ErpFormDriver] Host bridge fillFormData error, continuing with DOM driver:', err);
      }
    }

    const filledFields: Record<string, any> = {};
    const failedAttempts = new Map<string, Set<string>>();
    const maxPasses = 8;
    let pass = 0;

    while (pass < maxPasses) {
      pass++;
      let currentSchema = this.collectFormSchema(excludeContainer);
      if (pass === 1 && currentSchema.length === 0 && Object.keys(pendingFields).length > 0) {
        const waitMountStart = Date.now();
        while (Date.now() - waitMountStart < 1200) {
          await new Promise((r) => setTimeout(r, 120));
          currentSchema = this.collectFormSchema(excludeContainer);
          if (currentSchema.length > 0) break;
        }
      }
      const readyKeys = Object.keys(pendingFields).filter((k) => {
        if (
          String(pendingFields[k]).toUpperCase() === '$TOTAL' ||
          String(pendingFields[k]).toUpperCase() === 'TOTAL'
        ) {
          return false;
        }
        const schemaField = currentSchema.find(
          (s) => s.key === k || normalizeArabicText(s.label) === normalizeArabicText(k)
        );
        // Grid cells / product toolbar controls are filled by the grid driver (rows), never as header fields.
        return schemaField && !schemaField.disabled && schemaField.group !== 'grid';
      });

      // Sort readyKeys by DOM appearance in currentSchema to respect natural top-to-bottom cascade
      readyKeys.sort((a, b) => {
        const idxA = currentSchema.findIndex(
          (s) => s.key === a || normalizeArabicText(s.label) === normalizeArabicText(a)
        );
        const idxB = currentSchema.findIndex(
          (s) => s.key === b || normalizeArabicText(s.label) === normalizeArabicText(b)
        );
        return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
      });

      if (readyKeys.length === 0) {
        if (activeCopilotService && userMessage && (Object.keys(filledFields).length > 0 || failedAttempts.size > 0)) {
          const newUnmappedFields = currentSchema
            .filter((s) => {
              if (s.disabled || s.group === 'grid' || filledFields[s.key] || pendingFields[s.key]) return false;
              const prevFails = failedAttempts.get(s.key);
              // Only re-ask AI for a previously failed field if we now have observed dropdown options and haven't failed twice
              if (prevFails && (!s.options || s.options.length === 0 || prevFails.size >= 2)) {
                return false;
              }
              return true;
            })
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
              const leftoverRes: LeftoverResponse = await activeCopilotService.resolveErpLeftover({
                user_message: userMessage,
                extracted_data: fields || {},
                filled: filledFields,
                new_fields: newUnmappedFields,
              });

              if (leftoverRes && leftoverRes.fields) {
                let addedNewCandidate = false;
                for (const [k, v] of Object.entries(leftoverRes.fields)) {
                  if (v == null || filledFields[k]) continue;
                  const normVal = normalizeArabicText(String(v)).trim();
                  const prevFails = failedAttempts.get(k);
                  if (prevFails && prevFails.has(normVal)) {
                    continue; // Never retry the exact same value that already failed
                  }
                  pendingFields[k] = v;
                  addedNewCandidate = true;
                }
                if (addedNewCandidate) {
                  continue;
                }
              }
            } catch (err) {
              console.warn('[ProgressiveFill] leftover resolution error', err);
            }
          }
        }
        break;
      }

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

        if (isElementDisabled(targetElement)) {
          if (pass >= maxPasses) {
            delete pendingFields[rawKey];
            this.telemetry?.logFill(
              cleanKey,
              'skipped_disabled',
              'حقل للقراءة فقط/معطل — يتم ملؤه تلقائياً بواسطة النظام',
              rawVal
            );
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
          const prevErrIdx = results.findIndex((r) => r.field === cleanKey && r.status !== 'filled');
          if (prevErrIdx >= 0) {
            results.splice(prevErrIdx, 1);
          }
          results.push({
            field: cleanKey,
            value: rawVal,
            status: 'filled',
            message: 'تم إدخال القيمة بنجاح',
          });
          await this.settle(
            (targetElement.closest('form, app-base, .erp-card, [data-screen-content]') as HTMLElement) || undefined,
            { quietMs: 60, maxMs: 500 }
          );
          if (this.bridge?.isAvailable) {
            await this.waitFor(() => !this.bridge?.isPageBusy(), 2500);
          }
        } else {
          let failSet = failedAttempts.get(cleanKey);
          if (!failSet) {
            failSet = new Set<string>();
            failedAttempts.set(cleanKey, failSet);
          }
          failSet.add(normalizeArabicText(String(rawVal)).trim());

          this.telemetry?.logFill(
            cleanKey,
            status,
            status === 'ambiguous' ? 'الخيار غامض' : 'لم يتم العثور على العنصر',
            rawVal
          );
          const existingIdx = results.findIndex((r) => r.field === cleanKey);
          if (existingIdx >= 0) {
            results[existingIdx] = {
              field: cleanKey,
              value: rawVal,
              status,
              message: status === 'ambiguous' ? 'الخيار غامض' : 'لم يتم العثور على العنصر',
            };
          } else {
            results.push({
              field: cleanKey,
              value: rawVal,
              status,
              message: status === 'ambiguous' ? 'الخيار غامض' : 'لم يتم العثور على العنصر',
            });
          }
        }
      }
    }

    if (rows && rows.length > 0) {
      let rowFilledCount = 0;
      try {
        rowFilledCount = await this.fillGridRows(rows, excludeContainer, results);
      } catch (gridErr) {
        // Never swallow grid failures: surface them in the report and the session log.
        this.telemetry?.logError('GRID', 'fillGridRows threw an exception', gridErr);
        results.push({
          field: 'الأصناف',
          value: JSON.stringify(rows),
          status: 'not_found',
          message: `تعذر ملء جدول الأصناف: ${(gridErr as any)?.message || 'خطأ غير معروف'}`,
        });
      }
      const verification = await this.verifyGridRowsViaBridge(rows, results);
      rowFilledCount = Math.max(0, rowFilledCount - verification.revoked);
      filledCount += rowFilledCount;
      this.telemetry?.log(
        'GRID',
        `Completed filling grid rows: ${rowFilledCount}/${rows.length} rows verified`,
        { total: rows.length, filled: rowFilledCount, revoked: verification.revoked }
      );
      await this.settle(undefined, { quietMs: 60, maxMs: 400 });
    }

    const queryNorm = normalizeArabicText(userMessage || '').toLowerCase();
    const userWantsCashSettlement =
      queryNorm.includes('نقدا') ||
      queryNorm.includes('نقدي') ||
      queryNorm.includes('كاش') ||
      queryNorm.includes('سداد كامل') ||
      queryNorm.includes('بالكامل') ||
      queryNorm.includes('دفع الاجمالي') ||
      queryNorm.includes('سدد الاجمالي') ||
      queryNorm.includes('المحصل') ||
      queryNorm.includes('المدفوع');

    let explicitTotalKey: string | null = null;
    if (fields) {
      for (const [rawKey, rawVal] of Object.entries(fields)) {
        if (
          String(rawVal).toUpperCase() === '$TOTAL' ||
          String(rawVal).toUpperCase() === 'TOTAL'
        ) {
          explicitTotalKey = rawKey;
          break;
        }
      }
    }

    if (explicitTotalKey || (userWantsCashSettlement && rows && rows.length > 0)) {
      const cleanKey = explicitTotalKey
        ? explicitTotalKey.split('(')[0].trim().replace(/^['"]|['"]$/g, '')
        : 'المدفوع نقداً';
      let targetElement = explicitTotalKey ? this.findTargetElement(cleanKey, excludeContainer) : null;

      if (
        targetElement &&
        !(targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement)
      ) {
        targetElement = null;
      }

      if (!targetElement) {
        const paidSelectors = [
          'input[name="POPaidCurrancy" i]',
          'input[name="POPaid" i]',
          'input[name*="popaid" i]',
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
          'input[id*="madfou" i]',
          'input[name*="mohasal" i]',
          'input[id*="mohasal" i]',
          'input[formcontrolname*="mohasal" i]',
        ];
        for (const sel of paidSelectors) {
          const el = this.getActiveFormRoot().querySelector(sel) as HTMLInputElement;
          if (
            el &&
            (!excludeContainer || !excludeContainer.contains(el)) &&
            !el.disabled &&
            !el.readOnly
          ) {
            targetElement = el;
            break;
          }
        }
      }

      if (!targetElement) {
        const labels = Array.from(this.getActiveFormRoot().querySelectorAll('label'));
        for (const lbl of labels) {
          const text = normalizeArabicText(lbl.textContent || '');
          if (
            text.includes('مدفوع') ||
            text.includes('مسدد') ||
            text.includes('نقدا') ||
            text.includes('سداد') ||
            text.includes('محصل')
          ) {
            const group = lbl.closest('.form-group, .row, div, .dp-field');
            const inp = group?.querySelector('input') as HTMLInputElement;
            if (
              inp &&
              (!excludeContainer || !excludeContainer.contains(inp)) &&
              !inp.disabled &&
              !inp.readOnly
            ) {
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
          let sum = 0;
          for (const r of rows || []) {
            const q = parseFloat(String(r['الكمية'] || r['كمية'] || r['qty'] || 0)) || 0;
            const p =
              parseFloat(
                String(
                  r['السعر'] ||
                    r['سعر'] ||
                    r['التكلفة'] ||
                    r['تكلفة'] ||
                    r['price'] ||
                    r['cost'] ||
                    0
                )
              ) || 0;
            sum += q * p;
          }
          if (sum > 0) {
            finalVal = String(sum);
          } else {
            finalVal = finalVal || '0';
          }
        }
        this.setTextOrDate(targetElement, finalVal);
        if (!finalVal || Number(finalVal) <= 0) {
          // A zero total means the lines were not priced/bound — never claim a cash settlement of 0.
          this.telemetry?.log(
            'FILL',
            'Cash settlement skipped: calculated total is 0 (rows not priced/bound)',
            { field: cleanKey, total: finalVal },
            'WARN'
          );
          results.push({
            field: cleanKey || 'المدفوع نقداً',
            value: finalVal,
            status: 'not_found',
            message: 'الإجمالي صفر لأن الأصناف لم تُسعَّر/تُربط بالفاتورة — لم أعبّئ المدفوع نقداً.',
          });
        } else {
          filledCount++;
          results.push({
            field: cleanKey || 'المدفوع نقداً',
            value: finalVal,
            status: 'filled',
            message: `تم نسخ القيمة الإجمالية المحسوبة (${finalVal}) إلى خانة السداد والمدفوع نقداً`,
          });
          this.telemetry?.log(
            'FILL',
            `Populated calculated total (${finalVal}) into cash paid field`,
            {
              field: cleanKey,
              total: finalVal,
              targetId: targetElement.id || targetElement.getAttribute('name'),
            }
          );
        }
      }
    }

    const verifiedResults = verifyPostFillAssertions(results, excludeContainer);
    const verifiedFilledCount = verifiedResults.filter((r) => r.status === 'filled').length;

    return {
      success: verifiedFilledCount > 0,
      fieldsProcessed: verifiedResults.length,
      filledCount: verifiedFilledCount,
      results: verifiedResults,
    };
  }

  /**
   * Closed-loop check of the grid: asks the host (in-memory model) how many lines really carry a bound product.
   * Lines the DOM driver reported as filled but that have no product binding are revoked (reported `not_found`),
   * so the UI never shows a false "2/2 filled" and auto-save is never triggered on empty/unpriced lines.
   */
  private async verifyGridRowsViaBridge(
    rows: Record<string, any>[],
    results: FormFillResult[]
  ): Promise<{ revoked: number; bound: number; expected: number }> {
    const productKey = /(product|item|الصنف|المنتج)/i;
    const expected = rows.filter((r) => r && Object.keys(r).some((k) => productKey.test(k))).length;
    if (!this.bridge?.isAvailable || expected === 0) {
      return { revoked: 0, bound: expected, expected };
    }

    await this.settle(undefined, { quietMs: 150, maxMs: 600 });
    const ctx = this.bridge.getActiveFormContext(true);
    const ctxRows = Array.isArray(ctx?.rows) ? ctx!.rows! : [];
    if (ctxRows.length === 0) {
      return { revoked: 0, bound: expected, expected }; // host exposes no row model: cannot verify
    }

    const isBound = (r: Record<string, any>) =>
      Object.keys(r || {}).some((k) => /(product|item)/i.test(k) && /id$/i.test(k) && !!r[k]);
    const isPriced = (r: Record<string, any>) =>
      Number(r?.['Total'] ?? r?.['TotalCurrancy'] ?? 0) > 0 || Number(r?.['UnitePrice'] ?? r?.['Cost'] ?? 0) > 0;
    const dataRows = ctxRows.filter((r) => r && Object.keys(r).some((k) => k !== 'new'));
    const bound = dataRows.filter(isBound).length;
    const priced = dataRows.filter((r) => isBound(r) && isPriced(r)).length;

    this.telemetry?.log(
      'GRID',
      `Bridge row verification: ${bound}/${expected} lines have a bound product (${priced} priced)`,
      { expected, bound, priced, modelRows: dataRows.length },
      bound >= expected ? 'INFO' : 'WARN'
    );

    if (bound >= expected) return { revoked: 0, bound, expected };

    let toRevoke = expected - bound;
    let revoked = 0;
    for (let i = results.length - 1; i >= 0 && toRevoke > 0; i--) {
      const res = results[i];
      if (res.status === 'filled' && (/^row_\d+$/.test(res.field) || res.field.startsWith('سطر جدول'))) {
        results[i] = {
          ...res,
          status: 'not_found',
          message: 'الصنف لم يُربط بالفاتورة داخل النظام (لا يوجد ProductID) — راجع الصنف يدوياً.',
        };
        toRevoke--;
        revoked++;
      }
    }
    return { revoked, bound, expected };
  }

  /**
   * Writes an exchange rate value directly to the DOM input[type="number"] that
   * represents ExchangePrice/سعر الصرف, dispatching native input+change events so
   * Angular reactive forms detect the change and the ERP server persists the value.
   *
   * Returns the found element or null if no matching input was located.
   */
  writeExchangePriceDom(excludeContainer: HTMLElement | undefined, rate: number): HTMLInputElement | null {
    try {
      const formRoot = this.getActiveFormRoot() as HTMLElement;
      // 1. Try named selectors (most reliable when attributes are present)
      const selectors = [
        'input[name="ExchangePrice"]',
        'input[id="ExchangePrice"]',
        'input[formcontrolname="ExchangePrice"]',
        'input[name="exchangeprice" i]',
        'input[formcontrolname="exchangeprice" i]',
      ];
      for (const sel of selectors) {
        const el = formRoot.querySelector(sel) as HTMLInputElement | null;
        if (el && (!excludeContainer || !excludeContainer.contains(el))) {
          this._nativeSetInputValue(el, String(rate));
          return el;
        }
      }
      // 2. Fallback: scan all number inputs; match by nearby label containing "سعر الصرف"
      const numberInputs = Array.from(formRoot.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
      for (const el of numberInputs) {
        if (excludeContainer && excludeContainer.contains(el)) continue;
        if (el.closest('ng-select, eg-select, mat-select')) continue;
        const container = el.closest('li, .dp-field, .form-group, .field-wrapper') || el.parentElement;
        const labelText = container?.textContent ?? '';
        if (/سعر.*صرف|صرف.*عمل|exchange.*rate|exchange.*price/i.test(labelText)) {
          this._nativeSetInputValue(el, String(rate));
          return el;
        }
      }
    } catch (err) {
      console.warn('[ErpFormDriver] writeExchangePriceDom failed:', err);
    }
    return null;
  }

  /** Writes a value via Angular-compatible native prototype setter + input/change events. */
  private _nativeSetInputValue(el: HTMLInputElement, value: string): void {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
