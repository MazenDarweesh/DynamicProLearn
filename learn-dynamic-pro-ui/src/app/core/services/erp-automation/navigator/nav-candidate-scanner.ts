import { NavCandidateIn, ControlIn } from '../../../models/erp-form.models';
import { normalizeArabicText } from '../form-driver/arabic-normalizer';
import { ErpBridgeService } from '../erp-bridge.service';

export function isNavElementVisible(el: Element): boolean {
  const htmlEl = el as HTMLElement;
  return !!(htmlEl.offsetWidth || htmlEl.offsetHeight || htmlEl.getClientRects().length);
}

export function simulateNavClick(el: HTMLElement): void {
  if (!el) return;
  try {
    el.focus?.();
  } catch {}
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  el.click();
}

export function checkIsScreenActive(screenKey: string, bridge: ErpBridgeService): boolean {
  if (!screenKey) return false;
  const normalizedKey = normalizeArabicText(screenKey);
  const upperKey = screenKey.toUpperCase().trim();

  // 0. Official ERP bridge (authoritative positive match)
  const active = bridge.getActiveScreen();
  if (active) {
    if (/^\d+$/.test(screenKey.trim()) && active.pageId != null) {
      return String(active.pageId) === screenKey.trim();
    }
    if (
      active.pageName &&
      (normalizeArabicText(active.pageName) === normalizedKey ||
        active.pageName.toUpperCase().trim() === upperKey)
    ) {
      return true;
    }
    if (
      active.title &&
      (normalizeArabicText(active.title) === normalizedKey ||
        active.title.toUpperCase().trim() === upperKey)
    ) {
      return true;
    }
    const screens = bridge.listScreens();
    if (screens && (active.pageName || active.screenKey || active.pageId != null)) {
      const matchedTarget = screens.find(
        (s) =>
          String(s.pageId) === screenKey.trim() ||
          (s.title && normalizeArabicText(s.title) === normalizedKey) ||
          (s.pageName && s.pageName.toUpperCase().trim() === upperKey)
      );
      if (matchedTarget) {
        if (matchedTarget.pageId != null && active.pageId != null) {
          return String(matchedTarget.pageId) === String(active.pageId);
        }
        if (
          active.pageName &&
          matchedTarget.pageName?.toUpperCase().trim() === active.pageName.toUpperCase().trim()
        ) {
          return true;
        }
        if (
          active.screenKey &&
          (matchedTarget.screenKey === active.screenKey || matchedTarget.pageName === active.screenKey)
        ) {
          return true;
        }
      }
    }
  }

  // 1. Check active tab or button with .active / .is-active specifically for this screenKey
  const activeTab = document.querySelector(
    `.screen-btn.active[data-screen="${screenKey}"], .screen-btn.active[data-screen="${upperKey}"], .dp-hdr__tab.is-active[data-screen="${screenKey}"], .dp-mods__card.is-active[data-screen="${screenKey}"], .dp-pgs__mod.is-active[data-screen="${screenKey}"]`
  );
  if (activeTab && isNavElementVisible(activeTab)) {
    return true;
  }

  // 2. Check active header tab text
  const activeHdrTabs = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.dp-hdr__tab.is-active .dp-hdr__tab-name, .dp-hdr__tab.is-active, .dp-hdr__trig-label'
    )
  );
  for (const tab of activeHdrTabs) {
    const text = normalizeArabicText(tab.textContent || '');
    if (text && (text === normalizedKey || text.includes(normalizedKey) || normalizedKey.includes(text))) {
      return true;
    }
  }

  // 3. Check active module text
  const activeMods = Array.from(
    document.querySelectorAll<HTMLElement>('.dp-pgs__mod.is-active .dp-pgs__mod-name, .dp-pgs__mod.is-active')
  );
  for (const mod of activeMods) {
    const text = normalizeArabicText(mod.textContent || '');
    if (text && (text === normalizedKey || text.includes(normalizedKey))) {
      return true;
    }
  }

  // 4. Check if the active form content matches this screenKey
  const formContent = document.querySelector(
    `[data-screen-content="${screenKey}"], [data-screen-content="${upperKey}"]`
  );
  if (formContent && isNavElementVisible(formContent)) {
    return true;
  }

  // 5. Check active screen tag in ERP card header or main page title (h1, h2, code)
  const activeHeaders = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.card-header h2, .erp-card h2, .screen-tag code, .page-title, h1, h2, .dp-hdr__title'
    )
  );
  for (const hdr of activeHeaders) {
    const text = normalizeArabicText(hdr.textContent || '');
    const rawText = (hdr.textContent || '').toUpperCase().trim();
    if (text === normalizedKey || rawText === upperKey || text.includes(normalizedKey)) {
      return true;
    }
  }

  return false;
}

export function scanDomAndBridgeCandidates(
  bridge: ErpBridgeService,
  candidateElementsMap: Map<string, HTMLElement>
): NavCandidateIn[] {
  candidateElementsMap.clear();
  const candidates: NavCandidateIn[] = [];
  const seenLabels = new Set<string>();
  const seenIds = new Set<string>();

  if (typeof document === 'undefined') {
    return candidates;
  }

  const badContainers = '.dp-set, #dpSettingsLabel, lms-ai-copilot, app-copilot-chat';
  const domSelectors = [
    '.dp-pgs__mod',
    '.dp-pgs__tile',
    '.dp-hdr__tab',
    '.dp-mods__card',
    '.dp-cats__chip',
    '.screen-btn',
    '[data-screen]',
    'app-menu-master-category-selector button',
    'app-fast-screen button',
  ].join(', ');

  const elements = Array.from(document.querySelectorAll<HTMLElement>(domSelectors));
  const activeModEl = document.querySelector<HTMLElement>(
    '.dp-pgs__mod.is-active .dp-pgs__mod-name, .dp-pgs__mod.is-active'
  );
  const activeModuleName = (activeModEl?.textContent || '').trim() || 'الرئيسية';

  let index = 1;
  for (const el of elements) {
    if (el.closest(badContainers)) continue;
    if (!isNavElementVisible(el)) continue;

    const labelSpan = el.querySelector<HTMLElement>(
      '.dp-pgs__tile-name, .dp-pgs__mod-name, .screen-label, .dp-mods__title, .dp-hdr__tabtxt, .dp-hdr__tab-name, .dp-cats__txt'
    );
    let rawText = (labelSpan?.textContent || el.textContent || '').trim();
    rawText = rawText.replace(/\[.*?\]/g, '').trim();

    if (!rawText || rawText.length < 2 || rawText.length > 150) continue;

    const normalized = normalizeArabicText(rawText);
    if (seenLabels.has(normalized)) continue;
    seenLabels.add(normalized);

    const candidateId =
      el.getAttribute('data-screen') ||
      el.getAttribute('data-page-name') ||
      el.getAttribute('data-page') ||
      el.getAttribute('data-page-id') ||
      el.getAttribute('pageName') ||
      (el.id && !el.id.startsWith('candidate_') ? el.id : undefined) ||
      `candidate_${index++}`;
    candidateElementsMap.set(candidateId, el);
    seenIds.add(candidateId);

    const path: string[] = [];
    if (el.classList.contains('dp-pgs__tile')) {
      path.push(activeModuleName);
      const cell = el.closest('.dp-pgs__cell');
      const prevGroup =
        cell?.previousElementSibling?.querySelector('.dp-grouphead__name') ||
        el.closest('[class*="group"]')?.querySelector('.dp-grouphead__name');
      if (prevGroup && prevGroup.textContent) {
        path.push(prevGroup.textContent.trim());
      }
    } else if (el.classList.contains('dp-pgs__mod')) {
      path.push('الوحدات والبرامج الرئيسية');
    } else if (el.classList.contains('dp-hdr__tab')) {
      path.push('التبويبات المفتوحة');
    } else {
      path.push(activeModuleName);
    }

    candidates.push({
      id: candidateId,
      label: rawText,
      path,
    });
  }

  const catalog = bridge.listScreens();
  if (catalog && catalog.length > 0) {
    for (const s of catalog as any[]) {
      const pid = s.page_id ?? s.pageId;
      const key = String(s.screen_key ?? s.pageName ?? (pid ? String(pid) : 'screen')).trim();
      const titleAr = String(s.name_ar ?? s.title ?? s.pageName ?? key).trim();
      const mod = String(s.moduleName ?? s.module ?? '').trim();
      const idStr = String(pid || key);
      const labelStr = titleAr || key;
      const normLabel = normalizeArabicText(labelStr);
      if (seenIds.has(idStr) || seenLabels.has(normLabel)) continue;
      seenIds.add(idStr);
      seenLabels.add(normLabel);
      candidates.push({
        id: idStr,
        label: labelStr,
        path: mod ? [mod] : [],
      });
    }
  }

  return candidates;
}

export function scanDomVisibleControls(
  container?: HTMLElement
): { controls: ControlIn[]; elementMap: Map<string, HTMLElement> } {
  const parent = container || (document.querySelector('[role="main"]') as HTMLElement) || document.body;
  const candidates = Array.from(
    parent.querySelectorAll<HTMLElement>('button, a[role="button"], input[type="button"], input[type="submit"]')
  );
  const controls: ControlIn[] = [];
  const elementMap = new Map<string, HTMLElement>();
  let idx = 1;

  for (const el of candidates) {
    if (el.closest('lms-ai-copilot, app-copilot-chat, nav, .dp-hdr')) continue;
    if (!isNavElementVisible(el)) continue;

    const id = el.getAttribute('data-action') || el.id || `ctrl_${idx++}`;
    const text = (el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
    const cleanLabel = (text || el.getAttribute('title') || id).slice(0, 80).trim();
    if (!cleanLabel) continue;

    controls.push({
      id,
      label: cleanLabel,
    });
    elementMap.set(id, el);
  }
  return { controls, elementMap };
}

