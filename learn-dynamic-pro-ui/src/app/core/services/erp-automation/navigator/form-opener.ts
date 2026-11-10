import { normalizeArabicText } from '../form-driver/arabic-normalizer';
import { getActiveScreenContainer } from '../form-driver/dom-synchronizer';
import { ErpBridgeService } from '../erp-bridge.service';
import { ErpFormMode, ErpFormStateSnapshot } from '../../../models/erp-bridge.models';
import { isNavElementVisible, simulateNavClick } from './nav-candidate-scanner';

const PERSISTED_DOC_ID_KEYS = new Set([
  'poid',
  'ponumber',
  'salesinvoiceid',
  'invoiceid',
  'voucherid',
  'docid',
  'recordid',
  'orderid',
  'loanid',
]);

const EDIT_ACTION_PATTERNS: RegExp[] = [
  /(?:^|\s)(عدل|تعديل|غير|غيري|حدث|بدل|امسح|احذف|انقل|استبدل|صحح)(?:\s|$)/i,
  /الفاتوره السابقه|نفس الفاتوره|المستند السابق|المستند الحالي|نفس المستند|بجوار المنتج/i,
];

const NEW_DOC_PATTERNS: RegExp[] = [
  /فاتوره\s+.*جديده|مستند\s+جديد|سند\s+جديد|اضافه\s+جديد/i,
];

/** Returns true when the prompt targets edits on the currently open/previous document rather than a new record. */
export function isEditExistingFormQuery(query: string): boolean {
  const norm = normalizeArabicText(query || '').trim();
  if (!norm) return false;
  if (NEW_DOC_PATTERNS.some((rx) => rx.test(norm))) {
    return false;
  }
  return EDIT_ACTION_PATTERNS.some((rx) => rx.test(norm));
}

const BOILERPLATE_NEW_FORM_KEYS = new Set([
  'employeeid',
  'podate',
  'contractdate',
  'edate',
  'isstartdate',
  'expirdate',
  'deliverydate',
  'insurancestartdate',
  'insuranceenddate',
  'endvisitsdate',
  'lastdate',
  'tax',
]);

/** Returns explicit dirty flag reported by host `getFormState()`, or `null` when unavailable. */
export function isHostFormStateDirty(state: ErpFormStateSnapshot | null | undefined): boolean | null {
  if (!state) return null;
  if (typeof state.dirty === 'boolean') return state.dirty;
  if (typeof state.isDirty === 'boolean') return state.isDirty;
  return null;
}

/** Normalizes structured host `getFormState()` snapshots into the 4-state `ErpFormMode` union. */
export function resolveHostFormMode(state: ErpFormStateSnapshot | null | undefined): ErpFormMode | null {
  if (!state) return null;
  const rawMode = String(state.mode ?? '').trim().toLowerCase();

  if (state.isOpen === false || rawMode === 'closed' || rawMode === 'list' || rawMode === 'closedorlist' || rawMode === 'none') {
    return 'ClosedOrList';
  }

  const dirty = isHostFormStateDirty(state) === true;
  const hasDocId = state.docId != null && state.docId !== '' && state.docId !== 0 && state.docId !== '0';

  if (
    rawMode === 'saved' ||
    rawMode === 'savedopen' ||
    rawMode === 'edit' ||
    rawMode === 'update' ||
    rawMode === 'existing' ||
    state.isSaved === true ||
    state.isNew === false ||
    hasDocId
  ) {
    return 'SavedOpen';
  }

  if (rawMode === 'draft' || rawMode === 'unsaved' || rawMode === 'unsaveddraft') {
    return 'UnsavedDraft';
  }

  if (rawMode === 'new' || rawMode === 'empty' || rawMode === 'emptynew' || rawMode === 'add' || state.isNew === true) {
    return dirty ? 'UnsavedDraft' : 'EmptyNew';
  }

  if (state.isOpen === true) {
    return dirty ? 'UnsavedDraft' : 'EmptyNew';
  }

  return null;
}

/**
 * Classifies the active form into `'ClosedOrList' | 'EmptyNew' | 'UnsavedDraft' | 'SavedOpen'`.
 * Prefers host `DynamicERP.getFormState()`, falling back to `getActiveFormContext()` + DOM checks
 * when legacy host builds do not implement `getFormState()`.
 */
export function getFormModeFromBridgeAndDom(bridge: ErpBridgeService, forceRefresh = false): ErpFormMode {
  const hostState = bridge.getFormState(forceRefresh);
  if (hostState && isContextOfActiveScreen(bridge, hostState.screenName)) {
    const resolved = resolveHostFormMode(hostState);
    if (resolved) return resolved;
  }

  if (!checkIsFormAlreadyOpen(bridge, forceRefresh)) {
    return 'ClosedOrList';
  }

  const ctx = bridge.getActiveFormContext(forceRefresh);
  if (ctx && isContextOfActiveScreen(bridge, ctx.screenName)) {
    const dataObj = ctx.dataObject;
    if (dataObj && typeof dataObj === 'object') {
      for (const [k, v] of Object.entries(dataObj)) {
        if (
          PERSISTED_DOC_ID_KEYS.has(k.trim().toLowerCase()) &&
          v != null &&
          v !== '' &&
          v !== 0 &&
          v !== '0'
        ) {
          return 'SavedOpen';
        }
      }
    }

    const rows = Array.isArray(ctx.rows) ? ctx.rows : [];
    const hasBoundRow = rows.some(
      (r) =>
        r &&
        ((r['ProductID'] && Number(r['ProductID']) !== 0) ||
          (r['ItemId'] && Number(r['ItemId']) !== 0) ||
          r['AccountID'] ||
          (r['Qty'] != null && r['Qty'] !== '') ||
          (r['Quntity'] != null && r['Quntity'] !== '') ||
          r['new'] === false)
    );
    if (hasBoundRow) {
      return 'UnsavedDraft';
    }

    if (dataObj && typeof dataObj === 'object') {
      const hasDraftHeaderField = Object.entries(dataObj).some(
        ([k, v]) => !BOILERPLATE_NEW_FORM_KEYS.has(k.trim().toLowerCase()) && v != null && v !== ''
      );
      if (hasDraftHeaderField) {
        return 'UnsavedDraft';
      }
    }
  }

  return 'EmptyNew';
}

/**
 * The host keeps the previous screen's document in memory while another screen is active, so
 * `getActiveFormContext()` may describe a different screen than the one on display. A context is only
 * trusted when its screen name matches the active screen reported by the bridge.
 */
function isContextOfActiveScreen(bridge: ErpBridgeService, ctxScreenName?: string): boolean {
  const active = bridge.getActiveScreen()?.pageName;
  if (!ctxScreenName || !active) return true; // nothing to compare against
  return normalizeArabicText(ctxScreenName).trim().toLowerCase() === normalizeArabicText(active).trim().toLowerCase();
}

function hasVisibleFormMarkup(container: Element): boolean {
  const el = container.querySelector(
    'app-add-or-edit, .dp-edit, .dp-edit__head, section.dp-pu__sup, ng-select[formcontrolname], input#productQty'
  );
  return !!el && isNavElementVisible(el);
}

export function checkIsFormAlreadyOpen(bridge: ErpBridgeService, forceRefresh = false): boolean {
  const ctx = bridge.getActiveFormContext(forceRefresh);
  const container = typeof document === 'undefined' ? null : getActiveScreenContainer();
  if (ctx && ctx.isOpen !== false && isContextOfActiveScreen(bridge, ctx.screenName)) {
    // The host may keep the PREVIOUS screen's document object while a different screen is displayed
    // (a Sales screen reporting Purchases' dataObject). The DOM of the visible screen must agree.
    const domAgrees = !container || hasVisibleFormMarkup(container);
    if (domAgrees && (ctx.dataObject || (ctx.rows && ctx.rows.length >= 0 && ctx.formType !== 'dom') || ctx.isInvoice)) {
      return true;
    }
  }

  if (typeof document === 'undefined') return false;

  const modalForm = document.querySelector(
    '.cdk-overlay-container .dp-modal app-add-or-edit, ' +
      '.cdk-overlay-container .dp-modal, ' +
      '#addOrEditPopUp'
  );
  if (modalForm && isNavElementVisible(modalForm)) {
    return true;
  }

  const activePage = getActiveScreenContainer() || document;
  const pageForm = activePage.querySelector(
    'app-add-or-edit, .dp-edit, .dp-list__pre, .dp-edit__head, section.dp-pu__sup'
  );
  if (pageForm && isNavElementVisible(pageForm)) {
    return true;
  }

  const primaryInput = activePage.querySelector<HTMLElement>(
    'ng-select[formcontrolname], [formcontrolname="SupplierID"], [formcontrolname="CustomerID"], [formcontrolname="StoreID"], [formcontrolname="EmpId"], input#productQty'
  );
  if (primaryInput && isNavElementVisible(primaryInput)) {
    return true;
  }

  return false;
}

export function triggerDomAddNewButton(): boolean {
  if (typeof document === 'undefined') return false;

  const masterAddBtn = document.querySelector<HTMLElement>(
    'button.dp-btn--primary.dp-list__act, .dp-list__act.dp-btn--primary, button.dp-btn--new, [data-action="new"], button.dp-list__act'
  );
  const targetAddBtn = masterAddBtn?.closest('button') || masterAddBtn;
  if (targetAddBtn && isNavElementVisible(targetAddBtn)) {
    console.info('%c[ErpNavigator] Triggered "اضافة جديد" on Master List:', 'color:#10b981;font-weight:bold', targetAddBtn);
    simulateNavClick(targetAddBtn);
    return true;
  }

  const allButtons = Array.from(
    document.querySelectorAll<HTMLElement>(
      'app-master-list button, .dp-list__actions button, .header-actions button, .dp-shell__pages button, button'
    )
  );
  for (const btn of allButtons) {
    if (btn.closest('lms-ai-copilot, app-copilot-chat, nav, .dp-hdr')) continue;
    if (!isNavElementVisible(btn)) continue;
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
      simulateNavClick(btn);
      return true;
    }
  }
  return false;
}

