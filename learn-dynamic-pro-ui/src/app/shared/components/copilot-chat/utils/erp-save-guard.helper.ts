import {
  ErpActiveFormContext,
  ErpFormDiffEntry,
  ErpFormMode,
  ErpFormStateSnapshot,
  FormFieldSchema,
  normalizeArabicText,
} from '../../../../core/services/erp-automation';
import {
  isHostFormStateDirty,
  isEditExistingFormQuery,
  resolveHostFormMode,
} from '../../../../core/services/erp-automation/navigator/form-opener';
export { isEditExistingFormQuery };
import { CopilotFormFillData } from '../../../../core/models/copilot.models';

/**
 * Determines whether the action targets editing the active/open document (`true`)
 * or creating a new document (`false`).
 * Uses structured `fillData.action_intent` from the Extractor when present, falling
 * back to `isEditExistingFormQuery(query)` regex ONLY when `action_intent` is absent.
 */
export function resolveEditCurrentIntent(
  fillData: Pick<CopilotFormFillData, 'action_intent'> | undefined,
  query: string
): boolean {
  const structured = String(fillData?.action_intent ?? '').trim().toLowerCase();
  if (structured === 'edit_current') return true;
  if (structured === 'new') return false;
  return isEditExistingFormQuery(query);
}

export interface SaveGuardMessageState {
  saveStatus?: 'saving' | 'saved' | 'failed';
  targetFormMode?: ErpFormMode;
  requiresExplicitUpdateConfirm?: boolean;
  userConfirmedSavedUpdate?: boolean;
}

export interface SaveGuardDecision {
  allow: boolean;
  reason?: 'in_flight' | 'already_saved_msg' | 'requires_edit_card_confirm' | 'saved_not_dirty';
  userMessage?: string;
}

const KNOWN_FIELD_LABELS: Record<string, string> = {
  supplierid: 'المورد',
  sname: 'المورد',
  customerid: 'العميل',
  customeraccountname: 'العميل',
  storeid: 'المخزن',
  projectid: 'المشروع',
  posetting: 'طريقة الشراء',
  contracttype: 'طريقة البيع',
  currancyid: 'العملة',
  currencyid: 'العملة',
  costitemid: 'مركز التكلفة',
  safeaccounid: 'الخزينة',
  safeaccount: 'الخزينة',
  popaid: 'المدفوع نقداً',
  popaidcurrancy: 'المدفوع نقداً',
};

const DISPLAY_PAIR_KEYS: Record<string, string[]> = {
  supplierid: ['SName', 'SupplierName'],
  customerid: ['CustomerAccountName', 'CustomerName'],
  storeid: ['StoreName'],
  projectid: ['ProjectName'],
  currancyid: ['CurrancyName', 'CurrencyName'],
};

export function extractDocRef(
  state: ErpFormStateSnapshot | null | undefined,
  ctx: ErpActiveFormContext | null | undefined
): string | undefined {
  const fromState = state?.docNumber ?? state?.docId;
  if (fromState != null && fromState !== '' && fromState !== 0 && fromState !== '0') {
    return String(fromState);
  }
  const obj = ctx?.dataObject;
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of ['PONumber', 'poNumber', 'POID', 'poId', 'SalesInvoiceID', 'InvoiceID', 'VoucherID', 'docId', 'DocID']) {
    const val = obj[key];
    if (val != null && val !== '' && val !== 0 && val !== '0') {
      return String(val);
    }
  }
  return undefined;
}

/**
 * Pure save gate implementing:
 * 1) Concurrency lock (`isSavingInFlight`) & per-message status check.
 * 2) Mandatory Edit Card confirmation lock on `SavedOpen` (blocks `autoSaveAfterFill` and non-card calls).
 * 3) Simplified host-state idempotency guard (`mode === 'saved' && dirty === false`).
 */
export function evaluateSaveGuard(params: {
  isSavingInFlight: boolean;
  msg: SaveGuardMessageState;
  userClickedSave: boolean;
  formMode: ErpFormMode;
  formState: ErpFormStateSnapshot | null;
}): SaveGuardDecision {
  const { isSavingInFlight, msg, userClickedSave, formMode, formState } = params;

  if (isSavingInFlight || msg.saveStatus === 'saving') {
    return { allow: false, reason: 'in_flight' };
  }

  if (msg.saveStatus === 'saved') {
    return { allow: false, reason: 'already_saved_msg' };
  }

  const isSavedOpenEdit =
    msg.requiresExplicitUpdateConfirm === true ||
    msg.targetFormMode === 'SavedOpen' ||
    formMode === 'SavedOpen';

  if (isSavedOpenEdit && !userClickedSave && !msg.userConfirmedSavedUpdate) {
    return {
      allow: false,
      reason: 'requires_edit_card_confirm',
      userMessage: '⚠️ تم إيقاف الحفظ التلقائي لأن المستند محفوظ مسبقاً — يرجى التأكيد من كارت التعديل.',
    };
  }

  if (formState) {
    const resolvedStateMode = resolveHostFormMode(formState);
    const dirty = isHostFormStateDirty(formState);
    if (resolvedStateMode === 'SavedOpen' && dirty === false) {
      return {
        allow: false,
        reason: 'saved_not_dirty',
        userMessage: 'ℹ️ هذا المستند محفوظ بالفعل ولا توجد تعديلات غير محفوظة (dirty=false).',
      };
    }
  }

  return { allow: true };
}

function lookupCaseInsensitive(obj: Record<string, any> | null | undefined, key: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in obj) return obj[key];
  const lower = key.trim().toLowerCase();
  for (const [k, v] of Object.entries(obj)) {
    if (k.trim().toLowerCase() === lower) return v;
  }
  return undefined;
}

function readDomCurrentFieldValue(
  key: string,
  rootDoc?: Document | null,
  excludeContainer?: HTMLElement | null
): string | undefined {
  if (!rootDoc) return undefined;
  const escaped = key.replace(/"/g, '\\"');
  const candidates = Array.from(
    rootDoc.querySelectorAll<HTMLElement>(
      `[formcontrolname="${escaped}"], [name="${escaped}"], #${CSS.escape ? CSS.escape(key) : key}`
    )
  ).filter((el) => !excludeContainer || !excludeContainer.contains(el));

  const el = candidates[0];
  if (!el) return undefined;

  const tag = el.tagName.toLowerCase();
  if (tag === 'ng-select' || tag === 'eg-select') {
    const label = el.querySelector('.ng-value-label, .ng-value')?.textContent?.trim();
    return label || undefined;
  }
  if (tag === 'select') {
    const sel = el as HTMLSelectElement;
    return sel.selectedOptions?.[0]?.textContent?.trim() || sel.value || undefined;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value?.trim() || undefined;
  }
  return undefined;
}

function resolveFieldLabel(key: string, schemas?: FormFieldSchema[]): string {
  const lower = key.trim().toLowerCase();
  const fromSchema = schemas?.find(
    (s) => s.key?.trim().toLowerCase() === lower && s.label && s.label.trim().toLowerCase() !== lower
  );
  if (fromSchema?.label) return fromSchema.label.trim();
  return KNOWN_FIELD_LABELS[lower] || key;
}

function formatDiffValue(val: any): string {
  if (val === undefined || val === null || val === '') return '— (فارغ)';
  if (String(val).trim().toUpperCase() === '$CLEAR') return '∅ (مسح)';
  return String(val).trim();
}

/**
 * Builds header & row before/after diff entries for an edit against an open saved document.
 */
export function buildFormDiffEntries(
  preCtx: ErpActiveFormContext | null | undefined,
  fillData: CopilotFormFillData | undefined,
  schemas?: FormFieldSchema[],
  rootDoc?: Document | null,
  excludeContainer?: HTMLElement | null
): ErpFormDiffEntry[] {
  if (!fillData) return [];
  const entries: ErpFormDiffEntry[] = [];
  const dataObj = preCtx?.dataObject || {};

  if (fillData.fields && typeof fillData.fields === 'object') {
    for (const [rawKey, nextVal] of Object.entries(fillData.fields)) {
      const cleanKey = rawKey.split('(')[0].trim();
      const lower = cleanKey.toLowerCase();

      let currentVal: any = readDomCurrentFieldValue(cleanKey, rootDoc, excludeContainer);
      if (currentVal === undefined) {
        const pairKeys = DISPLAY_PAIR_KEYS[lower] || [];
        for (const pk of pairKeys) {
          const pv = lookupCaseInsensitive(dataObj, pk);
          if (pv != null && pv !== '') {
            currentVal = pv;
            break;
          }
        }
      }
      if (currentVal === undefined) {
        currentVal = lookupCaseInsensitive(dataObj, cleanKey);
      }

      const beforeStr = formatDiffValue(currentVal);
      const isClear = nextVal === null || nextVal === '' || String(nextVal).trim().toUpperCase() === '$CLEAR';
      const afterStr = isClear ? '∅ (مسح)' : formatDiffValue(nextVal);
      if (beforeStr === afterStr) continue;

      entries.push({
        key: cleanKey,
        label: resolveFieldLabel(cleanKey, schemas),
        before: beforeStr,
        after: afterStr,
        scope: 'header',
        kind: isClear ? 'cleared' : currentVal == null || currentVal === '' ? 'added' : 'changed',
      });
    }
  }

  const existingRows = (Array.isArray(preCtx?.rows) ? preCtx!.rows! : []).filter(
    (r) =>
      r &&
      ((r['ProductID'] && Number(r['ProductID']) !== 0) ||
        (r['ItemId'] && Number(r['ItemId']) !== 0) ||
        r['AccountID'] ||
        r['new'] === false)
  );
  const incomingRows = Array.isArray(fillData.rows) ? fillData.rows : [];

  incomingRows.forEach((rowObj, idx) => {
    const existing = existingRows[idx];
    const summaryCols = Object.entries(rowObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    const beforeCols = existing
      ? Object.entries(rowObj)
          .map(([k]) => {
            const cur = lookupCaseInsensitive(existing, k);
            return cur != null ? `${k}: ${cur}` : null;
          })
          .filter(Boolean)
          .join(' | ') || `سطر موجود (#${idx + 1})`
      : '— (سطر جديد)';

    if (beforeCols !== summaryCols) {
      entries.push({
        key: `row_${idx + 1}`,
        label: `سطر #${idx + 1}`,
        before: beforeCols,
        after: summaryCols,
        scope: 'row',
        rowIndex: idx,
        kind: existing ? 'changed' : 'added',
      });
    }
  });

  return entries;
}
