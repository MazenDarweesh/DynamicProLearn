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
        const lookupKeys = new Set(
          this.collectFormSchema(excludeContainer)
            .filter((s) => lookupKinds.has(s.kind))
            .map((s) => s.key)
        );
        const bridgeFields = Object.fromEntries(
          Object.entries(fields || {}).filter(([k]) => !lookupKeys.has(k))
        );
        // Only pass rows to in-memory bridge if they already carry resolved numeric ProductID / ItemId;
        // otherwise let fillGridRows add them via the DOM product picker so Angular resolves ProductID & price!
        const preResolvedRows = hasExistingRows
          ? []
          : (rows || []).filter((r: any) => r && (r.ProductID != null || r.ItemId != null));

        await this.bridge.fillFormData({
          fields: bridgeFields,
          rows: preResolvedRows
        });
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

    const pendingFields: Record<string, any> = { ...(fields || {}) };
    const filledFields: Record<string, any> = {};
    const failedAttempts = new Map<string, Set<string>>();
    const maxPasses = 8;
    let pass = 0;

    while (pass < maxPasses) {
      pass++;
      const currentSchema = this.collectFormSchema(excludeContainer);
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
        return schemaField && !schemaField.disabled;
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
              if (s.disabled || filledFields[s.key] || pendingFields[s.key]) return false;
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
      const rowFilledCount = await this.fillGridRows(rows, excludeContainer, results);
      filledCount += rowFilledCount;
      this.telemetry?.log(
        'GRID',
        `Completed filling grid rows: ${rowFilledCount}/${rows.length} rows filled`,
        { total: rows.length, filled: rowFilledCount }
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

    const verifiedResults = verifyPostFillAssertions(results, excludeContainer);
    const verifiedFilledCount = verifiedResults.filter((r) => r.status === 'filled').length;

    return {
      success: verifiedFilledCount > 0,
      fieldsProcessed: verifiedResults.length,
      filledCount: verifiedFilledCount,
      results: verifiedResults,
    };
  }
}
