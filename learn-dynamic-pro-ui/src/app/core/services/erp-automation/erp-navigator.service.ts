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
  checkIsFormAlreadyOpen,
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

  async navigateToScreen(screenKey: string): Promise<boolean> {
    if (this.isScreenActive(screenKey)) {
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

    if (this.bridge.isAvailable) {
      try {
        const opened = await this.bridge.triggerAddNew();
        if (opened) {
          const ready = await this.waitForFreshForm(requireEmptyNew, Math.min(1200, remainingMs()));
          if (ready) return true;
        }
      } catch (err) {
        console.warn('[ErpNavigator] bridge.triggerAddNew error:', err);
      }
    }

    while (Date.now() - start < maxWaitMs) {
      const currentMode = this.getFormMode(true);
      if (currentMode === 'EmptyNew' || (!requireEmptyNew && currentMode !== 'ClosedOrList')) {
        return true;
      }
      const clicked = triggerDomAddNewButton();
      if (clicked) {
        const ready = await this.waitForFreshForm(requireEmptyNew, Math.min(1500, remainingMs()));
        if (ready) return true;
      }
      await this.delay(Math.min(100, remainingMs()));
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
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const mode = this.getFormMode(true);
      if (requireEmptyNew ? mode === 'EmptyNew' : mode !== 'ClosedOrList') {
        return true;
      }
      await this.delay(50);
    }
    const mode = this.getFormMode(true);
    return requireEmptyNew ? mode === 'EmptyNew' : mode !== 'ClosedOrList';
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
  }> {
    const candidates = this.scanVisibleCandidates();
    if (candidates.length === 0) {
      return { success: false, decision: 'clarify', message: 'لم يتم العثور على أي شاشات متاحة في واجهة النظام حالياً.' };
    }

    if (!this.copilotService) {
      return { success: false, decision: 'clarify', message: 'خدمة الذكاء الاصطناعي غير متصلة.' };
    }

    try {
      const activeScreenName = this.bridge.getActiveScreen()?.pageName;
      const currentPath = activeScreenName ? [activeScreenName.trim()] : [];
      const res = await this.copilotService.resolveErpNavigation({
        user_message: userMessage,
        candidates,
        current_path: currentPath,
      });
      console.info('%c[ErpNavigator] resolve response from backend:', 'color:#8b5cf6;font-weight:bold', res);

      if (res.decision === 'go' && res.candidates.length > 0) {
        const top = res.candidates[0];

        if (activeScreenName && this.isScreenActive(top.id)) {
          console.info('%c[ErpNavigator] Already on target screen:', 'color:#10b981;font-weight:bold', top.id);
          return {
            success: true,
            decision: 'go',
            chosen: top,
            rawResolution: res,
          };
        }

        const activeNorm = (activeScreenName || '').trim().toLowerCase();
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

        if (res.intent === 'action') {
          const currentMode = this.getFormMode(true);
          const isOpenNonEmpty = currentMode === 'SavedOpen' || currentMode === 'UnsavedDraft';
          if (
            !(options?.deferFormPrepOnOpenForm && isOpenNonEmpty) &&
            !(currentMode === 'SavedOpen' && isEditExistingFormQuery(userMessage))
          ) {
            await this.prepareFreshForm();
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
        };
      } else if (res.decision === 'ask') {
        return {
          success: false,
          decision: 'ask',
          askOptions: res.candidates.slice(0, 3),
          rawResolution: res,
        };
      } else {
        return {
          success: false,
          decision: 'clarify',
          message: 'يرجى توضيح اسم الشاشة أو العملية المطلوبة (مثال: فاتورة مشتريات، تسجيل عميل).',
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
}
