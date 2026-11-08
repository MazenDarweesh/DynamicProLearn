import { normalizeArabicText } from '../../../../core/services/erp-automation';

export interface HostAttributesSnapshot {
  apiUrl?: string;
  backendUrl?: string;
  erpKey?: string;
  lmsPageId?: string;
  u?: string;
  p?: string;
  token?: string;
  hideHeader?: boolean;
  inline?: boolean;
}

export function readHostElementAttributes(
  hostEl: HTMLElement | undefined,
  current: HostAttributesSnapshot & { activeScreenKey?: string }
): HostAttributesSnapshot {
  if (!hostEl || !hostEl.getAttribute) {
    return current;
  }

  const getAttr = (kebab: string, camel: string) => {
    const val = hostEl.getAttribute(kebab) || hostEl.getAttribute(camel);
    return val ? val.trim() : undefined;
  };

  const clean = (val?: string) => {
    if (!val) return undefined;
    return val.trim().replace(/[<>]/g, '');
  };

  const hideHeaderAttr = getAttr('hide-header', 'hideHeader');
  const inlineAttr = getAttr('inline', 'inline');

  return {
    apiUrl: clean(current.apiUrl || getAttr('api-url', 'apiUrl')),
    backendUrl: clean(current.backendUrl || getAttr('backend-url', 'backendUrl')),
    erpKey: clean(
      current.erpKey ||
        current.activeScreenKey ||
        getAttr('active-screen-key', 'activeScreenKey') ||
        getAttr('erp-key', 'erpKey') ||
        getAttr('active-screen', 'activeScreen')
    ),
    lmsPageId: clean(current.lmsPageId || getAttr('lms-page-id', 'lmsPageId')),
    u: clean(current.u || getAttr('u', 'u')),
    p: clean(current.p || getAttr('p', 'p')),
    token: clean(current.token || getAttr('token', 'token')),
    hideHeader: hideHeaderAttr != null ? hideHeaderAttr === 'true' || hideHeaderAttr === '' : current.hideHeader,
    inline: inlineAttr != null ? inlineAttr === 'true' || inlineAttr === '' : current.inline,
  };
}

export function applyEmbeddedHostStyles(
  hostEl: HTMLElement | undefined,
  currentInline: boolean,
  currentHideHeader: boolean
): { isEmbedded: boolean; inline: boolean; hideHeader: boolean } {
  if (!hostEl) {
    return { isEmbedded: false, inline: currentInline, hideHeader: currentHideHeader };
  }

  const tagName = hostEl.tagName?.toLowerCase() || '';
  const parent = hostEl.parentElement;
  const parentTag = parent?.tagName?.toLowerCase() || '';

  const isCustomElement =
    tagName.includes('lms-copilot') || tagName.includes('ai-copilot') || tagName.includes('lms-ai');
  const isInsideContainer = !!(parent && parentTag !== 'body' && parentTag !== 'app-root');
  const hasEmbeddedFlag = !!(window as any)?.__LMS_COPILOT_EMBEDDED__ || !!(window as any)?.__ERP_HOST__;

  if (isCustomElement || isInsideContainer || currentInline || hasEmbeddedFlag) {
    hostEl.style.display = 'flex';
    hostEl.style.flexDirection = 'column';
    hostEl.style.width = '100%';
    hostEl.style.height = '100%';
    hostEl.style.flex = '1';
    hostEl.style.minHeight = '0';

    let current: HTMLElement | null = parent;
    while (current && current.tagName.toLowerCase() !== 'body' && current.tagName.toLowerCase() !== 'app-root') {
      if (current.classList.contains('ai-chat-window')) {
        break;
      }
      current.style.flex = '1';
      current.style.display = 'flex';
      current.style.flexDirection = 'column';
      current.style.minHeight = '0';
      current.style.height = '100%';
      current.style.overflow = 'hidden';
      current = current.parentElement;
    }

    const hasOuterHeader = !!(
      parent?.closest?.('.ai-chat-window') ||
      parent?.querySelector?.('.ai-chat-header') ||
      parent?.parentElement?.querySelector?.('.ai-chat-header')
    );

    return {
      isEmbedded: true,
      inline: true,
      hideHeader: hasOuterHeader ? true : currentHideHeader,
    };
  }

  return { isEmbedded: false, inline: currentInline, hideHeader: currentHideHeader };
}

export function evaluateActiveScreenMatch(
  query: string,
  activeScreen: { pageId?: string | number; pageName?: string; screenKey?: string; title?: string } | null,
  isDomActive: boolean
): {
  isAlreadyOnMatchingScreen: boolean;
  isExplicitNavRequest: boolean;
  isSetupOrConfigScreen: boolean;
  isAlreadyOnMatchingDomain: boolean;
} {
  const activeRaw = (activeScreen?.pageName || activeScreen?.screenKey || '').trim();
  const activeName = activeRaw.toLowerCase();
  const activeTitleNorm = normalizeArabicText(activeScreen?.title || '').toLowerCase();
  const activePid = activeScreen?.pageId != null ? String(activeScreen.pageId) : '';
  const queryNorm = normalizeArabicText(query || '').toLowerCase();

  const isInvoiceQuery =
    queryNorm.includes('فاتورة') ||
    queryNorm.includes('فواتير') ||
    queryNorm.includes('سند') ||
    queryNorm.includes('قيد');
  const isInvoiceScreen =
    activePid === '244' ||
    activePid === '289' ||
    activeTitleNorm.includes('فاتورة') ||
    activeTitleNorm.includes('فواتير') ||
    activeTitleNorm.includes('مشتريات') ||
    activeName.includes('invoice') ||
    activeName === 'purchases';

  const isSetupOrConfigScreen =
    activePid === '225' ||
    (!isInvoiceScreen && activeName.includes('type')) ||
    activeName.includes('setting') ||
    activeName.includes('config') ||
    activeName.includes('تعريف') ||
    activeName.includes('أنواع') ||
    activeName.includes('انواع') ||
    activeName.includes('تهيئة') ||
    activeTitleNorm.includes('انواع') ||
    activeTitleNorm.includes('أنواع') ||
    activeTitleNorm.includes('اعدادات');

  const isPurchaseQuery =
    queryNorm.includes('مشتريات') || queryNorm.includes('شراء') || queryNorm.includes('مورد');
  const isCurrentPurchase =
    !!activeName &&
    (activeName.includes('purchas') || activeName.includes('مشتريات') || activePid === '289');

  const isSalesQuery =
    queryNorm.includes('مبيعات') || queryNorm.includes('بيع') || queryNorm.includes('عميل');
  const isCurrentSales =
    !!activeName && (activeName.includes('sale') || activeName.includes('مبيعات') || activePid === '244');

  const isExplicitNavRequest = /^(افتح|انتقل|اذهب|وديني|روح|شاشة|صفحة)\s+/i.test(query.trim());
  const isAlreadyOnMatchingDomain =
    !isSetupOrConfigScreen &&
    ((isPurchaseQuery && isCurrentPurchase) || (isSalesQuery && isCurrentSales));

  const isAlreadyOnMatchingScreen =
    isDomActive &&
    !isSetupOrConfigScreen &&
    (!isInvoiceQuery || isInvoiceScreen) &&
    isAlreadyOnMatchingDomain;

  return {
    isAlreadyOnMatchingScreen,
    isExplicitNavRequest,
    isSetupOrConfigScreen,
    isAlreadyOnMatchingDomain,
  };
}

