import { Injectable, inject, Injector } from '@angular/core';
import { NavCandidateIn, NavResolution, NavScored, ControlIn } from '../../models/erp-form.models';
import { normalizeArabicText } from './form-driver/arabic-normalizer';
import { CopilotService } from '../ai-copilot/copilot.service';
import { ErpBridgeService } from './erp-bridge.service';
import { ErpFormMode } from '../../models/erp-bridge.models';
import {
  checkIsScreenActive,
  isNavElementVisible,
  scanDomAndBridgeCandidates,
  scanDomVisibleControls,
  simulateNavClick,
} from './navigator/nav-candidate-scanner';
import {
  getFormModeFromBridgeAndDom,
  isEditExistingFormQuery,
  triggerDomAddNewButton,
} from './navigator/form-opener';

@Injectable({
  providedIn: 'root',
})
export class ErpNavigatorService {
  private injector = inject(Injector);
  private bridge = inject(ErpBridgeService);
  private candidateElementsMap = new Map<string, HTMLElement>();
  private inFlightPrepare: Promise<boolean> | null = null;

  private get copilotService(): CopilotService | null {
    try {
      return this.injector.get(CopilotService, null);
    } catch {
      return null;
    }
  }

  isScreenActive(screenKey: string): boolean {
    return checkIsScreenActive(screenKey, this.bridge);
  }

  simulateClick(el: HTMLElement): void {
    simulateNavClick(el);
  }

  async navigateToScreen(screenKey: string, force = false): Promise<boolean> {
    if (!force && this.isScreenActive(screenKey)) {
      return true;
    }

    if (await this.bridge.navigateToScreen(screenKey)) {
      if (await this.waitForScreenReady(screenKey, 2500)) {
        return true;
      }
      console.warn('[ErpNavigator] Bridge navigation did not reach target, falling back to DOM:', screenKey);
    }

    window.dispatchEvent(
      new CustomEvent('lms:navigate', {
        bubbles: true,
        composed: true,
        detail: { screenKey },
      })
    );
    window.dispatchEvent(
      new CustomEvent('window:lms:navigate', {
        bubbles: true,
        composed: true,
        detail: { screenName: screenKey },
      })
    );

    const mapped = this.candidateElementsMap.get(screenKey);
    if (mapped) {
      this.simulateClick(mapped);
      return await this.waitForScreenReady(screenKey, 2500);
    }

    const directTarget = document.querySelector<HTMLElement>(
      `[data-screen="${screenKey}"], [data-screen="${screenKey.toUpperCase().trim()}"]`
    );
    if (directTarget && isNavElementVisible(directTarget)) {
      this.simulateClick(directTarget);
      return await this.waitForScreenReady(screenKey, 2500);
    }

    const normalizedTarget = normalizeArabicText(screenKey);
    const candidateEls = Array.from(
      document.querySelectorAll<HTMLElement>('.dp-pgs__tile, .dp-pgs__mod, .dp-hdr__tab, [routerlink], .nav-link')
    );
    for (const el of candidateEls) {
      const text = normalizeArabicText(el.textContent || '');
      if (text && (text === normalizedTarget || text.includes(normalizedTarget))) {
        this.simulateClick(el);
        return await this.waitForScreenReady(screenKey, 2500);
      }
    }

    return await this.waitForScreenReady(screenKey, 1500);
  }

  async waitForScreenReady(screenKey: string, timeoutMs = 2500): Promise<boolean> {
    const startTime = Date.now();
    let tabActivated = false;

    while (Date.now() - startTime < timeoutMs) {
      if (this.isScreenActive(screenKey)) {
        tabActivated = true;
        if (this.isScreenContentLoaded()) {
          return true;
        }
      }
      await this.delay(50);
    }
    return tabActivated;
  }

  isScreenContentLoaded(): boolean {
    if (typeof document === 'undefined') return true;
    if (this.bridge.isPageBusy()) return false;

    const activeContainer =
      (document.querySelector('.dp-shell__pages > div:not([hidden])') as HTMLElement) ||
      (document.querySelector('[role="main"]') as HTMLElement) ||
      document.body;

    const spinner = activeContainer.querySelector(
      '.dp-spinner, .loading-spinner, .dp-busy, .spinner-border, [role="progressbar"], .mat-progress-spinner, app-loading'
    );
    if (spinner && isNavElementVisible(spinner)) {
      return false;
    }

    const hasCoreComponent = activeContainer.querySelector(
      '#dpGrid, app-master-list, .dp-table, .dp-list__act, button.dp-btn--primary, app-add-or-edit, .dp-form, input, select'
    );
    return !!hasCoreComponent;
  }

  scanVisibleControls(container?: HTMLElement): { controls: ControlIn[]; elementMap: Map<string, HTMLElement> } {
    return scanDomVisibleControls(container);
  }

  async prepareFreshForm(
    maxWaitMs = 2500,
    options?: { resetSaved?: boolean; resetDraft?: boolean }
  ): Promise<boolean> {
    if (this.inFlightPrepare) {
      return this.inFlightPrepare;
    }
    this.inFlightPrepare = this._prepareFreshFormImpl(maxWaitMs, options).finally(() => {
      this.inFlightPrepare = null;
    });
    return this.inFlightPrepare;
  }

  private async _prepareFreshFormImpl(
    maxWaitMs = 2500,
    options?: { resetSaved?: boolean; resetDraft?: boolean }
  ): Promise<boolean> {
    const initialMode = this.getFormMode(true);
    if (initialMode === 'EmptyNew') {
      return true;
    }
    if (initialMode === 'UnsavedDraft' && !options?.resetDraft) {
      return true;
    }
    if (initialMode === 'SavedOpen' && options?.resetSaved === false) {
      return true;
    }

    const requireEmptyNew =
      initialMode === 'SavedOpen' ||
      (initialMode === 'UnsavedDraft' && options?.resetDraft === true);
    const start = Date.now();
    const remainingMs = () => Math.max(50, maxWaitMs - (Date.now() - start));

    let bridgeTriggered = false;
    if (this.bridge.isAvailable) {
      try {
        bridgeTriggered = await this.bridge.triggerAddNew();
        if (bridgeTriggered) {
          return await this.waitForFreshForm(requireEmptyNew, remainingMs());
        }
      } catch (err) {
        console.warn('[ErpNavigator] bridge.triggerAddNew error:', err);
      }
    }

    const currentMode = this.getFormMode(true);
    if (currentMode === 'EmptyNew' || (!requireEmptyNew && currentMode !== 'ClosedOrList')) {
      return true;
    }

    const clicked = triggerDomAddNewButton();
    if (clicked) {
      return await this.waitForFreshForm(requireEmptyNew, remainingMs());
    }

    const finalMode = this.getFormMode(true);
    return requireEmptyNew ? finalMode === 'EmptyNew' : finalMode !== 'ClosedOrList';
  }

  getFormMode(forceRefresh = false): ErpFormMode {
    return getFormModeFromBridgeAndDom(this.bridge, forceRefresh);
  }

  isFormAlreadyOpen(): boolean {
    return this.getFormMode() !== 'ClosedOrList';
  }

  async waitForFormContainer(timeoutMs = 1200): Promise<boolean> {
    return this.waitForFreshForm(false, timeoutMs);
  }

  private async waitForFreshForm(requireEmptyNew: boolean, timeoutMs = 1200): Promise<boolean> {
    const isTargetMode = () => {
      const mode = this.getFormMode(true);
      return requireEmptyNew ? mode === 'EmptyNew' : mode !== 'ClosedOrList';
    };
    if (isTargetMode()) {
      return true;
    }
    if (typeof document === 'undefined' || !document.body) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let intervalId: ReturnType<typeof setInterval> | null = null;
      let observer: MutationObserver | null = null;

      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
        if (intervalId !== null) clearInterval(intervalId);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        resolve(result);
      };

      const check = () => {
        try {
          if (isTargetMode()) {
            finish(true);
          }
        } catch {
          finish(false);
        }
      };

      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(() => check());
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      intervalId = setInterval(() => check(), 50);
      timeoutId = setTimeout(() => {
        try {
          finish(isTargetMode());
        } catch {
          finish(false);
        }
      }, timeoutMs);
    });
  }

  scanVisibleCandidates(): NavCandidateIn[] {
    return scanDomAndBridgeCandidates(this.bridge, this.candidateElementsMap);
  }

  async resolveAndNavigate(
    userMessage: string,
    options?: { deferFormPrepOnOpenForm?: boolean }
  ): Promise<{
    success: boolean;
    decision: 'go' | 'ask' | 'clarify';
    chosen?: NavScored;
    askOptions?: NavScored[];
    message?: string;
    rawResolution?: NavResolution;
    formPrepared?: boolean;
  }> {
    const candidates = this.scanVisibleCandidates();
    if (candidates.length === 0) {
      return { success: false, decision: 'clarify', message: 'لم يتم العثور على أي شاشات متاحة في واجهة النظام حالياً.' };
    }

    if (!this.copilotService) {
      return { success: false, decision: 'clarify', message: 'خدمة الذكاء الاصطناعي غير متصلة.' };
    }

    try {
      const activeScreen = this.bridge.getActiveScreen();
      const activeScreenName = (activeScreen?.pageName || activeScreen?.screenKey || '').trim();
      const hasActiveScreen = !!(activeScreenName || activeScreen?.pageId != null);
      const currentPath = activeScreenName ? [activeScreenName] : [];
      const res = await this.copilotService.resolveErpNavigation({
        user_message: userMessage,
        candidates,
        current_path: currentPath,
      });
      console.info('%c[ErpNavigator] resolve response from backend:', 'color:#8b5cf6;font-weight:bold', res);

      if (res.decision === 'go' && res.candidates.length > 0) {
        const top = res.candidates[0];

        if (hasActiveScreen && this.isScreenActive(top.id)) {
          console.info('%c[ErpNavigator] Already on target screen:', 'color:#10b981;font-weight:bold', top.id);
          return {
            success: true,
            decision: 'go',
            chosen: top,
            rawResolution: res,
          };
        }

        const activeNorm = activeScreenName.toLowerCase();
        const topIdNorm = top.id.trim().toLowerCase();
        const isDetailScreen =
          topIdNorm.includes('detail') ||
          topIdNorm.includes('تفاصيل') ||
          topIdNorm.includes('report') ||
          topIdNorm.includes('تقرير') ||
          topIdNorm.includes('total') ||
          topIdNorm.includes('اجمالي') ||
          topIdNorm.includes('إجمالي') ||
          topIdNorm.includes('ارصدة') ||
          topIdNorm.includes('أرصدة');
        const isSameDomain =
          (activeNorm.includes('purchas') && topIdNorm.includes('purchas')) ||
          (activeNorm.includes('sale') && topIdNorm.includes('sale')) ||
          (activeNorm.includes('entry') && topIdNorm.includes('entry'));

        if (isSameDomain && isDetailScreen) {
          console.info(
            `%c[ErpNavigator] Downgrade prevented: Already on primary screen '${activeScreenName}', refusing to switch to detail screen '${top.id}'`,
            'color:#10b981;font-weight:bold'
          );
          return {
            success: true,
            decision: 'go',
            chosen: { id: activeScreenName || top.id, confidence: 1.0, reason: 'Retained primary transactional screen' },
            rawResolution: res,
          };
        }

        const targetEl = this.candidateElementsMap.get(top.id);
        const realScreenName =
          targetEl?.getAttribute('data-screen') ||
          targetEl?.getAttribute('data-page-name') ||
          targetEl?.getAttribute('data-page') ||
          targetEl?.getAttribute('pageName') ||
          (!top.id.startsWith('candidate_') ? top.id : undefined);

        if (targetEl) {
          this.simulateClick(targetEl);
          await this.delay(400);
        } else if (realScreenName) {
          await this.navigateToScreen(realScreenName);
        }

        let formPrepared = false;
        if (res.intent === 'action') {
          const currentMode = this.getFormMode(true);
          const isOpenNonEmpty = currentMode === 'SavedOpen' || currentMode === 'UnsavedDraft';
          if (
            !(options?.deferFormPrepOnOpenForm && isOpenNonEmpty) &&
            !(currentMode === 'SavedOpen' && isEditExistingFormQuery(userMessage))
          ) {
            formPrepared = await this.prepareFreshForm();
          }
        }

        const matchedCandidate = candidates.find((c) => c.id === top.id);
        const enrichedTop =
          matchedCandidate && !(top as any).label ? { ...top, label: matchedCandidate.label } : top;

        return {
          success: true,
          decision: 'go',
          chosen: enrichedTop,
          rawResolution: res,
          formPrepared,
        };
      } else if (res.decision === 'ask') {
        const askOptions = res.candidates.slice(0, 5).map((opt) => {
          const matched = candidates.find((c) => c.id === opt.id);
          return matched && !opt.label ? { ...opt, label: matched.label } : opt;
        });
        return {
          success: false,
          decision: 'ask',
          askOptions,
          rawResolution: res,
        };
      } else {
        const localAskOptions =
          res.intent === 'navigate' && candidates.length > 0
            ? this.buildLocalClarifyOptions(userMessage, candidates, 5)
            : [];
        return {
          success: false,
          decision: 'clarify',
          askOptions: localAskOptions.length > 0 ? localAskOptions : undefined,
          message:
            localAskOptions.length > 0
              ? 'طلبك يحتمل أكثر من شاشة، أي شاشة تقصد فتحها؟'
              : 'يرجى توضيح اسم الشاشة أو العملية المطلوبة (مثال: فواتير المشتريات، فواتير المبيعات).',
          rawResolution: res,
        };
      }
    } catch (err: any) {
      console.error('[ErpNavigator] resolveAndNavigate error', err);
      return {
        success: false,
        decision: 'clarify',
        message: 'حدث خطأ أثناء التواصل مع محرك الذكاء الاصطناعي، يرجى المحاولة لاحقاً.',
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Builds local clarification chip candidates prioritized by main operational modules
   * and core allowlisted screens (never by numeric ID cutoff) when backend nav resolves 'clarify'.
   */
  private buildLocalClarifyOptions(
    query: string,
    candidates: NavCandidateIn[],
    maxOptions: number = 5
  ): NavScored[] {
    const stopWords = new Set(['افتح', 'اذهب', 'انتقل', 'شاشه', 'شاشة', 'صفحه', 'صفحة', 'عايز', 'محتاج', 'ممكن', 'الي', 'الى', 'من', 'في', 'علي', 'على']);
    const primaryModules = new Set([
      normalizeArabicText('الموردين و المشتريات'),
      normalizeArabicText('العملاء  و المبيعات'),
      normalizeArabicText('العملاء و المبيعات'),
      normalizeArabicText('الحسابات العامه'),
      normalizeArabicText('المخازن'),
      normalizeArabicText('المرتبات'),
      normalizeArabicText('التصنيع'),
    ]);
    const secondaryModules = new Set([
      normalizeArabicText('الفاتورة الالكترونية'),
      normalizeArabicText('الادارة العليا'),
      normalizeArabicText('تقارير تكملية'),
      normalizeArabicText('اعدادات'),
      normalizeArabicText('اعدادات المرتبات'),
      normalizeArabicText('الانظمة المتخصصة'),
      normalizeArabicText('المراجعة والترحيل'),
    ]);
    const coreAllowlist = new Set([
      normalizeArabicText('فواتير المشتريات'),
      normalizeArabicText('فواتير المبيعات'),
      normalizeArabicText('المشتريات'),
      normalizeArabicText('بيانات الموردين'),
      normalizeArabicText('بيانات العملاء'),
      normalizeArabicText('قيود اليومية'),
      normalizeArabicText('حركات المخازن'),
      normalizeArabicText('تحويلات المخازن'),
    ]);
    const secondaryKw = ['المرحله', 'فلاحين', 'البان', 'مصمم', 'تفاصيل', 'تقرير', 'استعلام', 'اعدادات', 'الكترونيه'].map((w) => normalizeArabicText(w));

    const qNorm = normalizeArabicText(query);
    const qTokens = qNorm
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !stopWords.has(t))
      .map((t) => (t.startsWith('ال') && t.length >= 5 ? t.slice(2) : t));
    if (qTokens.length === 0) return [];

    const stemMap: Record<string, string[]> = {
      فواتير: ['فاتور', 'فواتير'],
      مبيعات: ['مبيع', 'بيع', 'مبيعات'],
      مشتريات: ['مشتري', 'شراء', 'مشتريات'],
    };

    const scored: { opt: NavScored; tier: number }[] = [];
    for (const c of candidates) {
      const labelNorm = normalizeArabicText(c.label || '');
      const pathNorms = (c.path || []).map((p) => normalizeArabicText(p));
      const fullNorm = `${labelNorm} ${pathNorms.join(' ')}`;

      let matchCount = 0;
      for (const tok of qTokens) {
        const variants = stemMap[tok] || [tok];
        if (variants.some((v) => fullNorm.includes(v))) {
          matchCount++;
        }
      }
      if (matchCount === 0) continue;

      const isPrimaryMod = pathNorms.some((p) => primaryModules.has(p));
      const isSecondaryMod = pathNorms.some((p) => secondaryModules.has(p));
      const isCore = coreAllowlist.has(labelNorm);
      const hasSecondaryKw = secondaryKw.some((kw) => kw && labelNorm.includes(kw));
      const userAskedSecondary = secondaryKw.some((kw) => kw && labelNorm.includes(kw) && qNorm.includes(kw));

      let tier = 1;
      if ((isSecondaryMod || hasSecondaryKw) && !userAskedSecondary) tier = 0;
      else if (isPrimaryMod && isCore) tier = 3;
      else if (isPrimaryMod || isCore) tier = 2;

      const conf = Number(Math.min(0.82, 0.50 + matchCount * 0.1 + tier * 0.05).toFixed(2));
      scored.push({
        tier,
        opt: { id: c.id, label: c.label, confidence: conf, reason: 'ترشيح محلي حسب الوحدة الأساسية' },
      });
    }

    return scored
      .sort((a, b) => b.tier - a.tier || b.opt.confidence - a.opt.confidence)
      .slice(0, maxOptions)
      .map((s) => s.opt);
  }
}
