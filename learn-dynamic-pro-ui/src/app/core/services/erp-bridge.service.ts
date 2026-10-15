import { Injectable } from '@angular/core';
import { ErpActiveScreen, ErpScreenInfo, ErpSaveResult } from '../models/erp-bridge.models';

/**
 * Single safe access point to the host ERP's `window.DynamicERP` bridge.
 * Every method returns `null`/`false` when the bridge (or the call) is unavailable,
 * so callers can fall back to DOM-based logic. Failures are logged, never swallowed.
 */
@Injectable({
  providedIn: 'root'
})
export class ErpBridgeService {
  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.DynamicERP;
  }

  getActiveScreen(): ErpActiveScreen | null {
    if (!this.isAvailable) return null;
    try {
      return window.DynamicERP!.getActiveScreen?.() ?? null;
    } catch (err) {
      console.warn('[ErpBridge] getActiveScreen failed:', err);
      return null;
    }
  }

  listScreens(): ErpScreenInfo[] | null {
    if (!this.isAvailable || typeof window.DynamicERP!.listScreens !== 'function') return null;
    try {
      return window.DynamicERP!.listScreens() ?? null;
    } catch (err) {
      console.warn('[ErpBridge] listScreens failed:', err);
      return null;
    }
  }

  /**
   * Checks if host ERP indicates active screen is busy with background HTTP requests or defer loading.
   */
  isPageBusy(): boolean {
    if (!this.isAvailable || typeof window.DynamicERP!.isPageBusy !== 'function') return false;
    try {
      return !!window.DynamicERP!.isPageBusy();
    } catch {
      return false;
    }
  }

  /** Returns true if the bridge call completed without error and was not rejected by host. */
  async navigateToScreen(screenNameOrId: string | number): Promise<boolean> {
    return this.invoke('navigateToScreen', () => window.DynamicERP!.navigateToScreen(screenNameOrId));
  }

  /**
   * Returns true if the bridge found the action and opened the form.
   * If host returns `false` (e.g. button not found or already in form), returns `false` to trigger fallbacks.
   */
  async triggerAddNew(): Promise<boolean> {
    return this.invoke('triggerAddNew', () => window.DynamicERP!.triggerAddNew());
  }

  /**
   * Submits the active form and normalizes the response into a structured ErpSaveResult.
   * Handles boolean, object { success, docId, errors }, or void return types safely.
   */
  async submitActiveForm(): Promise<ErpSaveResult> {
    if (!this.isAvailable) {
      return { success: false, errors: ['جسر الـ ERP غير متاح في هذه البيئة.'] };
    }
    try {
      const raw = await window.DynamicERP!.submitActiveForm();
      if (raw && typeof raw === 'object') {
        const obj = raw as any;
        return {
          success: obj.success !== false,
          docId: obj.docId || obj.id,
          errors: Array.isArray(obj.errors) ? obj.errors : undefined,
          message: obj.message
        };
      }
      if (raw === false) {
        return { success: false, errors: ['فشل الحفظ في نظام الـ ERP.'] };
      }
      return { success: true };
    } catch (err: any) {
      console.warn('[ErpBridge] submitActiveForm failed:', err);
      return {
        success: false,
        errors: [err?.message || 'حدث خطأ أثناء تنفيذ الحفظ في نظام الـ ERP.']
      };
    }
  }

  private async invoke(name: string, call: () => unknown): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      const res = await call();
      // Crucial: If the host method explicitly returned `false`, respect that as failure
      if (res === false) {
        console.warn(`[ErpBridge] ${name} returned false from host.`);
        return false;
      }
      return true;
    } catch (err) {
      console.warn(`[ErpBridge] ${name} failed:`, err);
      return false;
    }
  }
}
