import { normalizeArabicText } from '../form-driver/arabic-normalizer';
import { getActiveScreenContainer } from '../form-driver/dom-synchronizer';
import { ErpBridgeService } from '../erp-bridge.service';
import { isNavElementVisible, simulateNavClick } from './nav-candidate-scanner';

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

export function checkIsFormAlreadyOpen(bridge: ErpBridgeService): boolean {
  const ctx = bridge.getActiveFormContext();
  const container = typeof document === 'undefined' ? null : getActiveScreenContainer();
  if (ctx && isContextOfActiveScreen(bridge, ctx.screenName)) {
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

