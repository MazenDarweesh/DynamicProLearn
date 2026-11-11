import { Injectable, inject } from '@angular/core';
import {
  ErpFormMode,
  ErpTableRowPayload
} from '../../../models/erp-bridge.models';
import { FormFieldSchema } from '../../../models/erp-form.models';
import { ErpBridgeService } from '../erp-bridge.service';
import { ErpNavigatorService } from '../erp-navigator.service';
import { ErpTelemetryService } from '../erp-telemetry.service';
import {
  convertEasternToWesternNumerals,
  normalizeArabicText
} from '../form-driver/arabic-normalizer';
import {
  EntityResolutionIssue,
  PurchasesEntityResolverService,
  PurchasesWave1ResolutionResult
} from './purchases-entity-resolver.service';
import {
  PURCHASES_SAFE_HEADER_ORDER,
  PURCHASES_WAVE1_LOOKUP_TABLE,
  PurchasesWave1HeaderField
} from './purchases-wave1-registry';

const EXPLICIT_EXCHANGE_RATE_KEYS = [
  'ExchangePrice',
  'CurrancyEX',
  'exchangeRate',
  'سعر الصرف',
  'سعر التحويل',
  'سعر العملة'
] as const;

const HOST_EXCHANGE_RATE_KEYS = ['ExchangePrice', 'CurrancyEX', 'ExchangeRate'] as const;
const HOST_TOTAL_KEYS = ['Total', 'NetTotal', 'TotalCurrancy', 'FinalTotal', 'GrandTotal'] as const;
const ROW_TOTAL_KEYS = ['Total', 'NetTotal', 'RowTotal', 'TotalCurrancy', 'FinalTotal', 'SubTotal'] as const;
const ACTUAL_ROW_PRODUCT_KEYS = ['ProductID', 'ProID', 'ItemID'] as const;
const ACTUAL_ROW_QTY_KEYS = ['Qty', 'Quntity', 'Quantity'] as const;
const ACTUAL_ROW_PRICE_KEYS = ['Price', 'UnitPrice', 'Cost', 'PriceCurrancy'] as const;

export interface PurchasesV250AppliedHeaderEntry {
  field: PurchasesWave1HeaderField;
  labelAr: string;
  id: string | number;
  label: string;
}

export interface PurchasesV250PlannedRow {
  rowIndex: number;
  ProductID: string | number;
  label: string;
  Qty: number;
  Price?: number;
}

export interface PurchasesV250ExchangeRateInfo {
  currencyId?: string | number;
  currencyLabel?: string;
  hostComputedRate?: number;
  userSpecifiedRate?: number;
  hasMismatch: boolean;
  missingHostRate?: boolean;
}

export interface PurchasesV250ActualHeaderCheck {
  field: PurchasesWave1HeaderField;
  labelAr: string;
  plannedId: string | number;
  plannedLabel: string;
  actualValue: unknown;
  matches: boolean;
}

export interface PurchasesV250PreviewState {
  mode: 'new' | 'edit_current';
  isSavedOpenEdit: boolean;
  expectedPOID?: string | number;
  expectedPONumber?: string | number;
  plannedHeaders: PurchasesV250AppliedHeaderEntry[];
  plannedRows: PurchasesV250PlannedRow[];
  actualDataObject: Record<string, unknown>;
  actualHeaders: PurchasesV250ActualHeaderCheck[];
  actualRows: Array<Record<string, unknown>>;
  plannedTotal?: number;
  actualTotal?: number;
  exchangeRateInfo?: PurchasesV250ExchangeRateInfo;
  warnings: string[];
}

export interface PurchasesV250PartialFailure {
  failedStep: string;
  failedStepLabelAr: string;
  completedSteps: string[];
  reason?: string;
  message: string;
}

export interface PurchasesV250ExecutionResult {
  status:
    | 'ready_for_preview'
    | 'needs_resolution'
    | 'needs_draft_confirm'
    | 'kept_draft'
    | 'prep_failed'
    | 'partial_failure';
  mutated: boolean;
  isEditCurrent: boolean;
  initialFormMode: ErpFormMode;
  resolution?: PurchasesWave1ResolutionResult;
  appliedHeaders?: PurchasesV250AppliedHeaderEntry[];
  appliedRows?: PurchasesV250PlannedRow[];
  completedSteps: string[];
  failure?: PurchasesV250PartialFailure;
  preview?: PurchasesV250PreviewState;
  errorMessage?: string;
}

export interface PurchasesV250PrepareFormResult {
  status: 'ready' | 'needs_draft_confirm' | 'kept_draft' | 'failed';
  errorMessage?: string;
}

export interface PurchasesV250ExecuteParams {
  fields?: Record<string, unknown>;
  rows?: Array<Record<string, unknown>>;
  schema?: FormFieldSchema[];
  isEditCurrent: boolean;
  draftResetDecision?: 'pending' | 'reset_and_new' | 'keep_draft';
  preselectedLookupIds?: Partial<Record<PurchasesWave1HeaderField, string | number>>;
  preselectedRowItemIds?: Record<number, string | number>;
  resolvedSchemaFields?: Record<string, string>;
  fetchOptions?: { maxEmptyRetries?: number; retryDelayMs?: number };
  prepareFormFn: (
    modeBeforePrep: ErpFormMode,
    isEditCurrent: boolean
  ) => Promise<PurchasesV250PrepareFormResult>;
}

/**
 * Determines whether the current command / active screen targets the Wave 1
 * Purchases screen (`Page 289`). Other modules stay on the legacy form-fill path.
 */
export function isPurchasesTargetScreen(
  screenKey?: string,
  pageId?: number | string | null,
  activeScreen?: { pageId?: number; pageName?: string } | null
): boolean {
  if (pageId != null && String(pageId).trim() !== '') {
    const numId = Number(pageId);
    if (Number.isFinite(numId)) {
      return numId === 289;
    }
  }

  const candidateText = normalizeArabicText(`${screenKey || ''} ${activeScreen?.pageName || ''}`);
  if (/(?:purchase|purchases|purchase invoice|مشتريات|فواتير الشراء|فاتورة المشتريات|فاتورة شراء)/i.test(candidateText)) {
    return true;
  }

  if (screenKey && /(?:sales|customer|journal|accounting|مبيعات|عملاء|قيد)/i.test(normalizeArabicText(screenKey))) {
    return false;
  }

  return activeScreen?.pageId === 289;
}

function parseFiniteNumeric(val: unknown): number | undefined {
  if (val == null || typeof val === 'boolean') return undefined;
  const cleaned = convertEasternToWesternNumerals(String(val)).replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

function readCaseInsensitiveKey(
  obj: Record<string, unknown> | null | undefined,
  candidateKeys: readonly string[]
): { found: boolean; value: unknown } {
  if (!obj || typeof obj !== 'object') {
    return { found: false, value: undefined };
  }
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return { found: true, value: obj[key] };
    }
  }
  const lowerEntries = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerEntries.set(normalizeArabicText(k).toLowerCase(), v);
  }
  for (const key of candidateKeys) {
    const norm = normalizeArabicText(key).toLowerCase();
    if (lowerEntries.has(norm)) {
      return { found: true, value: lowerEntries.get(norm) };
    }
  }
  return { found: false, value: undefined };
}

function firstNonEmptyId(values: unknown[]): string | number | undefined {
  for (const v of values) {
    if (v != null && String(v).trim() !== '' && v !== 0 && v !== '0') {
      return typeof v === 'number' ? v : String(v);
    }
  }
  return undefined;
}

/**
 * Step 3 execution engine for Purchases (Page 289) on `DynamicERP >= 2.5.0`:
 * Guards + Read-only Resolver -> prepareFreshForm -> clearTableRows (before headers)
 * -> selectLookup in safe order (POSetting -> CurrancyID -> SupplierID -> StoreID)
 * -> addTableRow per item -> Actual-State Preview (without manual ExchangePrice injection).
 */
@Injectable({ providedIn: 'root' })
export class PurchasesV250ExecutorService {
  private bridge = inject(ErpBridgeService);
  private navigator = inject(ErpNavigatorService);
  private resolver = inject(PurchasesEntityResolverService);
  private telemetry = inject(ErpTelemetryService, { optional: true });

  async execute(params: PurchasesV250ExecuteParams): Promise<PurchasesV250ExecutionResult> {
    const completedSteps: string[] = [];
    const initialFormMode = this.navigator.getFormMode(true);
    const preEditState = params.isEditCurrent ? this.bridge.getFormState(true) : null;
    const preEditCtx = params.isEditCurrent ? this.bridge.getActiveFormContext(true) : null;

    // 1. Draft conflict guard MUST run before touching or resolving anything destructive
    if (initialFormMode === 'UnsavedDraft' && !params.isEditCurrent) {
      if (params.draftResetDecision === 'keep_draft') {
        return {
          status: 'kept_draft',
          mutated: false,
          isEditCurrent: params.isEditCurrent,
          initialFormMode,
          completedSteps
        };
      }
      if (params.draftResetDecision !== 'reset_and_new') {
        return {
          status: 'needs_draft_confirm',
          mutated: false,
          isEditCurrent: params.isEditCurrent,
          initialFormMode,
          completedSteps
        };
      }
    }

    // 2. When ClosedOrList, mount form first so lookups are initialized in the host
    if (initialFormMode === 'ClosedOrList') {
      const mountPrep = await params.prepareFormFn(initialFormMode, params.isEditCurrent);
      if (mountPrep.status !== 'ready') {
        return {
          status: mountPrep.status === 'failed' ? 'prep_failed' : mountPrep.status,
          mutated: false,
          isEditCurrent: params.isEditCurrent,
          initialFormMode,
          completedSteps,
          errorMessage: mountPrep.errorMessage
        };
      }
    }

    // 3. Strictly read-only Entity Resolution BEFORE mutating form or resetting SavedOpen/UnsavedDraft
    const resolution = await this.resolver.resolveWave1({
      fields: params.fields,
      rows: params.rows,
      schema: params.schema,
      preselectedLookupIds: params.preselectedLookupIds,
      preselectedRowItemIds: params.preselectedRowItemIds,
      resolvedSchemaFields: params.resolvedSchemaFields,
      fetchOptions: params.fetchOptions
    });

    this.telemetry?.log('FILL', 'Purchases v2.5.0 Wave 1 resolution finished', {
      readyToApply: resolution.readyToApply,
      initialFormMode,
      isEditCurrent: params.isEditCurrent,
      metricsSummary: resolution.metricsSummary,
      blockingIssuesCount: resolution.blockingIssues.length
    });

    if (!resolution.readyToApply) {
      return {
        status: 'needs_resolution',
        mutated: false,
        isEditCurrent: params.isEditCurrent,
        initialFormMode,
        resolution,
        completedSteps
      };
    }

    // 4. Open fresh form in creation mode when currently on SavedOpen or UnsavedDraft (user confirmed reset)
    if (!params.isEditCurrent && initialFormMode !== 'EmptyNew' && initialFormMode !== 'ClosedOrList') {
      const prepRes = await params.prepareFormFn(initialFormMode, false);
      if (prepRes.status !== 'ready') {
        return {
          status: prepRes.status === 'failed' ? 'prep_failed' : prepRes.status,
          mutated: false,
          isEditCurrent: params.isEditCurrent,
          initialFormMode,
          resolution,
          completedSteps,
          errorMessage: prepRes.errorMessage
        };
      }
    }

    // 5. Strict safety guard: clearTableRows MUST NEVER run on SavedOpen/UnsavedDraft in creation mode
    const liveModeBeforeClear = this.navigator.getFormMode(true);
    if (!params.isEditCurrent && (liveModeBeforeClear === 'SavedOpen' || liveModeBeforeClear === 'UnsavedDraft')) {
      const guardMsg =
        '⛔ تم منع تفريغ الجدول (clearTableRows) حفاظاً على المستند المحفوظ أو المسودة؛ يجب أن يكون النموذج EmptyNew أولاً.';
      this.telemetry?.log('FILL', guardMsg, { liveModeBeforeClear }, 'ERROR');
      return {
        status: 'prep_failed',
        mutated: false,
        isEditCurrent: params.isEditCurrent,
        initialFormMode,
        resolution,
        completedSteps,
        errorMessage: guardMsg
      };
    }

    const appliedHeaders: PurchasesV250AppliedHeaderEntry[] = [];
    const appliedRows: PurchasesV250PlannedRow[] = [];

    // 6. clearTableRows BEFORE header fields (skipped on header-only edit_current with zero rows)
    const shouldClearTableRows = !params.isEditCurrent || resolution.rowResolutions.length > 0;
    if (shouldClearTableRows) {
      const clearRes = await this.bridge.clearTableRows();
      if (clearRes.ok !== true) {
        return this.buildPartialFailureResult({
          failedStep: 'clearTableRows',
          failedStepLabelAr: 'تفريغ جدول الأصناف',
          reason: clearRes.reason,
          completedSteps,
          appliedHeaders,
          appliedRows,
          resolution,
          isEditCurrent: params.isEditCurrent,
          initialFormMode
        });
      }
      completedSteps.push('clearTableRows');
    }

    // 7. Execute Wave 1 header lookups in safe order: POSetting -> CurrancyID -> SupplierID -> StoreID
    // NOTE: Never manually inject ExchangePrice; selectLookup('CurrancyID', id) triggers host calculation.
    for (const fieldKey of PURCHASES_SAFE_HEADER_ORDER) {
      const outcome = resolution.headerResolutions[fieldKey];
      if (!outcome || outcome.status !== 'resolved' || outcome.resolvedId == null) {
        continue;
      }

      const selRes = await this.bridge.selectLookup(fieldKey, outcome.resolvedId);
      if (selRes.ok !== true) {
        return this.buildPartialFailureResult({
          failedStep: fieldKey,
          failedStepLabelAr: outcome.labelAr,
          reason: selRes.reason,
          completedSteps,
          appliedHeaders,
          appliedRows,
          resolution,
          isEditCurrent: params.isEditCurrent,
          initialFormMode
        });
      }

      completedSteps.push(`selectLookup:${fieldKey}`);
      appliedHeaders.push({
        field: fieldKey,
        labelAr: outcome.labelAr,
        id: outcome.resolvedId,
        label: outcome.resolvedLabel || String(outcome.resolvedId)
      });
    }

    // 8. Insert each resolved row via structured addTableRow
    let qtyDefaultedWarning = false;
    for (const rowOutcome of resolution.rowResolutions) {
      const stepKey = `addTableRow#${rowOutcome.rowIndex + 1}`;
      const stepLabelAr = `إضافة الصنف #${rowOutcome.rowIndex + 1} (${rowOutcome.resolvedLabel || rowOutcome.rawTerm})`;

      if (rowOutcome.resolvedId == null) {
        return this.buildPartialFailureResult({
          failedStep: stepKey,
          failedStepLabelAr: stepLabelAr,
          reason: 'معرف الصنف غير محدد.',
          completedSteps,
          appliedHeaders,
          appliedRows,
          resolution,
          isEditCurrent: params.isEditCurrent,
          initialFormMode
        });
      }

      if (rowOutcome.qty != null && (!Number.isFinite(rowOutcome.qty) || rowOutcome.qty <= 0)) {
        return this.buildPartialFailureResult({
          failedStep: stepKey,
          failedStepLabelAr: stepLabelAr,
          reason: `كمية الصنف غير صالحة (${rowOutcome.qty}).`,
          completedSteps,
          appliedHeaders,
          appliedRows,
          resolution,
          isEditCurrent: params.isEditCurrent,
          initialFormMode
        });
      }

      const effectiveQty = rowOutcome.qty != null ? rowOutcome.qty : 1;
      if (rowOutcome.qty == null) {
        qtyDefaultedWarning = true;
      }

      const rowPayload: ErpTableRowPayload = {
        ProductID: rowOutcome.resolvedId,
        Qty: effectiveQty
      };
      if (rowOutcome.price != null && Number.isFinite(rowOutcome.price)) {
        rowPayload.Price = rowOutcome.price;
      }

      const addRes = await this.bridge.addTableRow(rowPayload);
      if (addRes.ok !== true) {
        return this.buildPartialFailureResult({
          failedStep: stepKey,
          failedStepLabelAr: stepLabelAr,
          reason: addRes.reason,
          completedSteps,
          appliedHeaders,
          appliedRows,
          resolution,
          isEditCurrent: params.isEditCurrent,
          initialFormMode
        });
      }

      completedSteps.push(stepKey);
      appliedRows.push({
        rowIndex: rowOutcome.rowIndex,
        ProductID: rowOutcome.resolvedId,
        label: rowOutcome.resolvedLabel || rowOutcome.rawTerm,
        Qty: effectiveQty,
        Price: rowOutcome.price
      });
    }

    // 9. Read ACTUAL host form context & table rows to construct verified Preview
    const preview = await this.buildActualPreview({
      fields: params.fields,
      isEditCurrent: params.isEditCurrent,
      isSavedOpenEdit: params.isEditCurrent && initialFormMode === 'SavedOpen',
      preEditState,
      preEditCtx,
      appliedHeaders,
      appliedRows,
      qtyDefaultedWarning
    });

    this.telemetry?.log('FILL', 'Purchases v2.5.0 execution completed and actual preview built', {
      completedSteps,
      warningsCount: preview.warnings.length,
      actualRowsCount: preview.actualRows.length
    });

    return {
      status: 'ready_for_preview',
      mutated: completedSteps.length > 0,
      isEditCurrent: params.isEditCurrent,
      initialFormMode,
      resolution,
      appliedHeaders,
      appliedRows,
      completedSteps,
      preview
    };
  }

  /**
   * Recovery action offered on `partial_failure`: clears rows and triggers Add New
   * so a half-filled form is never left around or accidentally saved.
   */
  async resetHalfFilledForm(): Promise<{ ok: boolean; errorMessage?: string }> {
    const clearRes = await this.bridge.clearTableRows();
    const newOpened = await this.bridge.triggerAddNew();
    const ok = clearRes.ok === true && newOpened === true;
    this.telemetry?.log(
      'FILL',
      'User triggered resetHalfFilledForm after partial v2.5.0 failure',
      { clearOk: clearRes.ok, triggerAddNewOk: newOpened, reason: clearRes.reason },
      ok ? 'INFO' : 'WARN'
    );
    return {
      ok,
      errorMessage: ok
        ? undefined
        : clearRes.reason || 'تعذر إعادة تهيئة الشاشة تلقائياً؛ يرجى الضغط على «إضافة جديد» يدوياً داخل الـ ERP.'
    };
  }

  private buildPartialFailureResult(args: {
    failedStep: string;
    failedStepLabelAr: string;
    reason?: string;
    completedSteps: string[];
    appliedHeaders: PurchasesV250AppliedHeaderEntry[];
    appliedRows: PurchasesV250PlannedRow[];
    resolution: PurchasesWave1ResolutionResult;
    isEditCurrent: boolean;
    initialFormMode: ErpFormMode;
  }): PurchasesV250ExecutionResult {
    const reasonSuffix = args.reason ? ` (${args.reason})` : '';
    const message =
      `⛔ توقف التنفيذ في خطوة "${args.failedStepLabelAr}" (${args.failedStep})${reasonSuffix}. تم تعطيل الحفظ لحماية الفاتورة من التعديل الجزئي؛ اضغط «ابدأ من جديد».`;

    this.telemetry?.log(
      'FILL',
      'Purchases v2.5.0 halted on mid-way failure',
      {
        failedStep: args.failedStep,
        completedSteps: args.completedSteps,
        reason: args.reason
      },
      'ERROR'
    );

    return {
      status: 'partial_failure',
      mutated: true,
      isEditCurrent: args.isEditCurrent,
      initialFormMode: args.initialFormMode,
      resolution: args.resolution,
      appliedHeaders: args.appliedHeaders,
      appliedRows: args.appliedRows,
      completedSteps: args.completedSteps,
      failure: {
        failedStep: args.failedStep,
        failedStepLabelAr: args.failedStepLabelAr,
        completedSteps: [...args.completedSteps],
        reason: args.reason,
        message
      },
      errorMessage: message
    };
  }

  private async buildActualPreview(args: {
    fields?: Record<string, unknown>;
    isEditCurrent: boolean;
    isSavedOpenEdit: boolean;
    preEditState: ReturnType<ErpBridgeService['getFormState']>;
    preEditCtx: ReturnType<ErpBridgeService['getActiveFormContext']>;
    appliedHeaders: PurchasesV250AppliedHeaderEntry[];
    appliedRows: PurchasesV250PlannedRow[];
    qtyDefaultedWarning: boolean;
  }): Promise<PurchasesV250PreviewState> {
    const actualCtx = this.bridge.getActiveFormContext(true);
    const actualRows = await this.bridge.getTableRows();
    const postState = this.bridge.getFormState(true);
    const actualDataObject: Record<string, unknown> =
      actualCtx?.dataObject && typeof actualCtx.dataObject === 'object' ? { ...actualCtx.dataObject } : {};

    const warnings: string[] = [];
    if (args.qtyDefaultedWarning) {
      warnings.push('⚠️ لم تُذكر كمية صريحة لأحد الأصناف، فتم اعتماد الكمية الافتراضية (1).');
    }

    const actualHeaders: PurchasesV250ActualHeaderCheck[] = [];
    for (const hdr of args.appliedHeaders) {
      const spec = PURCHASES_WAVE1_LOOKUP_TABLE[hdr.field];
      const fieldLookup = readCaseInsensitiveKey(actualDataObject, [hdr.field, spec.valueKey]);
      const actualVal = fieldLookup.value;
      const matches = !fieldLookup.found || actualVal == null || String(actualVal) === String(hdr.id);
      if (fieldLookup.found && (actualVal == null || String(actualVal) === '' || String(actualVal) !== String(hdr.id))) {
        warnings.push(
          `⚠️ حقل "${hdr.labelAr}" الفعلي في الشاشة (${actualVal ?? 'فارغ'}) يختلف عن القيمة المختارة (${hdr.id}).`
        );
      }
      actualHeaders.push({
        field: hdr.field,
        labelAr: hdr.labelAr,
        plannedId: hdr.id,
        plannedLabel: hdr.label,
        actualValue: fieldLookup.found ? actualVal : undefined,
        matches
      });
    }

    if (args.appliedRows.length > 0 && actualRows.length !== args.appliedRows.length) {
      warnings.push(
        `⚠️ عدد الصفوف الفعلي في جدول الـ ERP (${actualRows.length}) يختلف عن العدد المخطط (${args.appliedRows.length}).`
      );
    }

    const minComparable = Math.min(args.appliedRows.length, actualRows.length);
    for (let i = 0; i < minComparable; i++) {
      const planned = args.appliedRows[i];
      const actual = actualRows[i];
      const prodLookup = readCaseInsensitiveKey(actual, ACTUAL_ROW_PRODUCT_KEYS);
      if (prodLookup.found && prodLookup.value != null && String(prodLookup.value) !== String(planned.ProductID)) {
        warnings.push(
          `⚠️ صنف الصف #${i + 1} الفعلي (${prodLookup.value}) يختلف عن المخطط (${planned.ProductID}).`
        );
      }
      const qtyLookup = readCaseInsensitiveKey(actual, ACTUAL_ROW_QTY_KEYS);
      const actualQty = qtyLookup.found ? parseFiniteNumeric(qtyLookup.value) : undefined;
      if (actualQty != null && Math.abs(actualQty - planned.Qty) > 0.0001) {
        warnings.push(
          `⚠️ كمية الصف #${i + 1} الفعلية (${actualQty}) تختلف عن المخططة (${planned.Qty}).`
        );
      }
    }

    const plannedTotal =
      args.appliedRows.length > 0 && args.appliedRows.every((r) => r.Price != null && Number.isFinite(r.Price))
        ? Number(args.appliedRows.reduce((acc, r) => acc + r.Qty * (r.Price as number), 0).toFixed(4))
        : undefined;

    let computedRowsTotal = 0;
    let hasComputedRowsTotal = false;
    for (const row of actualRows) {
      const rowTotalLookup = readCaseInsensitiveKey(row, ROW_TOTAL_KEYS);
      const explicitRowTotal = rowTotalLookup.found ? parseFiniteNumeric(rowTotalLookup.value) : undefined;
      if (explicitRowTotal != null) {
        computedRowsTotal += explicitRowTotal;
        hasComputedRowsTotal = true;
        continue;
      }
      const qtyVal = parseFiniteNumeric(readCaseInsensitiveKey(row, ACTUAL_ROW_QTY_KEYS).value);
      const priceVal = parseFiniteNumeric(readCaseInsensitiveKey(row, ACTUAL_ROW_PRICE_KEYS).value);
      if (qtyVal != null && priceVal != null) {
        computedRowsTotal += qtyVal * priceVal;
        hasComputedRowsTotal = true;
      }
    }
    const normalizedRowsTotal = hasComputedRowsTotal ? Number(computedRowsTotal.toFixed(4)) : undefined;
    const docTotalLookup = readCaseInsensitiveKey(actualDataObject, HOST_TOTAL_KEYS);
    const actualDocTotal = docTotalLookup.found ? parseFiniteNumeric(docTotalLookup.value) : undefined;
    const actualTotal = actualDocTotal ?? normalizedRowsTotal;

    if (plannedTotal != null && actualTotal != null && Math.abs(plannedTotal - actualTotal) > 0.01) {
      warnings.push(
        `⚠️ الإجمالي الفعلي في الشاشة (${actualTotal}) يختلف عن الإجمالي المخطط (${plannedTotal}).`
      );
    }
    if (actualDocTotal != null && normalizedRowsTotal != null && Math.abs(actualDocTotal - normalizedRowsTotal) > 0.01) {
      warnings.push(
        `⚠️ إجمالي رأس الفاتورة (${actualDocTotal}) لا يطابق مجموع صفوف الجدول (${normalizedRowsTotal}).`
      );
    }

    // Exchange rate inspection: NEVER inject manually; compare explicit user rate with host Currancy calculation
    const currencyHeader = args.appliedHeaders.find((h) => h.field === 'CurrancyID');
    const hostRateLookup = readCaseInsensitiveKey(actualDataObject, HOST_EXCHANGE_RATE_KEYS);
    const hostComputedRate = hostRateLookup.found ? parseFiniteNumeric(hostRateLookup.value) : undefined;
    const userRateLookup = readCaseInsensitiveKey(args.fields, EXPLICIT_EXCHANGE_RATE_KEYS);
    const userSpecifiedRate = userRateLookup.found ? parseFiniteNumeric(userRateLookup.value) : undefined;

    let exchangeRateInfo: PurchasesV250ExchangeRateInfo | undefined;
    if (currencyHeader || userSpecifiedRate != null || hostComputedRate != null) {
      const hasRateDiff =
        userSpecifiedRate != null && hostComputedRate != null && Math.abs(userSpecifiedRate - hostComputedRate) > 0.0001;
      const missingHostRate = userSpecifiedRate != null && hostComputedRate == null;

      if (hasRateDiff) {
        warnings.push(
          `⚠️ حددت سعر صرف (${userSpecifiedRate}) وهو يختلف عن السعر المحسوب تلقائياً من الـ ERP (${hostComputedRate}). لم يتم التعديل يدوياً؛ يرجى التأكيد قبل الحفظ.`
        );
      } else if (missingHostRate) {
        warnings.push(
          `⚠️ حددت سعر صرف (${userSpecifiedRate})، لكن تعذر قراءة سعر الصرف المحسوب من الـ ERP؛ تأكد من القيمة داخل الشاشة قبل الحفظ.`
        );
      }

      exchangeRateInfo = {
        currencyId: currencyHeader?.id,
        currencyLabel: currencyHeader?.label,
        hostComputedRate,
        userSpecifiedRate,
        hasMismatch: hasRateDiff || missingHostRate,
        missingHostRate
      };
    }

    let expectedPOID: string | number | undefined;
    let expectedPONumber: string | number | undefined;
    if (args.isSavedOpenEdit) {
      expectedPOID = firstNonEmptyId([
        postState?.docId,
        args.preEditState?.docId,
        actualDataObject['POID'],
        args.preEditCtx?.dataObject?.['POID']
      ]);
      expectedPONumber = firstNonEmptyId([
        postState?.docNumber,
        args.preEditState?.docNumber,
        actualDataObject['PONumber'],
        args.preEditCtx?.dataObject?.['PONumber']
      ]);
    }

    return {
      mode: args.isEditCurrent ? 'edit_current' : 'new',
      isSavedOpenEdit: args.isSavedOpenEdit,
      expectedPOID,
      expectedPONumber,
      plannedHeaders: args.appliedHeaders,
      plannedRows: args.appliedRows,
      actualDataObject,
      actualHeaders,
      actualRows,
      plannedTotal,
      actualTotal,
      exchangeRateInfo,
      warnings
    };
  }
}

