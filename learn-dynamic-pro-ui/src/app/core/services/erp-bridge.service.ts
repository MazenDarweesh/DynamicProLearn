import { Injectable, inject } from '@angular/core';
import {
  ErpActiveScreen,
  ErpScreenInfo,
  ErpSaveResult,
  ErpFormFillPayload,
  ErpActiveFormContext
} from '../models/erp-bridge.models';
import { ErpTelemetryService } from './erp-telemetry.service';

/**
 * Single safe access point to the host ERP's `window.DynamicERP` bridge.
 * Every method returns `null`/`false` when the bridge (or the call) is unavailable,
 * so callers can fall back to DOM-based logic. Failures are logged, never swallowed.
 */
@Injectable({
  providedIn: 'root'
})
export class ErpBridgeService {
  private telemetry = inject(ErpTelemetryService, { optional: true });

  get isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.DynamicERP;
  }

  getActiveScreen(): ErpActiveScreen | null {
    if (!this.isAvailable) return null;
    try {
      const screen = window.DynamicERP!.getActiveScreen?.() ?? null;
      this.telemetry?.logBridge('getActiveScreen', undefined, screen);
      if (screen?.pageName) {
        this.telemetry?.setScreenKey(screen.pageName);
      }
      return screen;
    } catch (err) {
      console.warn('[ErpBridge] getActiveScreen failed:', err);
      this.telemetry?.logBridge('getActiveScreen', undefined, null, err);
      return null;
    }
  }

  listScreens(): ErpScreenInfo[] | null {
    if (!this.isAvailable) return null;
    try {
      const bridge = window.DynamicERP as any;
      let screens: ErpScreenInfo[] | null = null;
      if (typeof bridge.listUserPages === 'function') screens = bridge.listUserPages() ?? null;
      else if (typeof bridge.listScreens === 'function') screens = bridge.listScreens() ?? null;
      else if (typeof bridge.getScreens === 'function') screens = bridge.getScreens() ?? null;
      else if (typeof bridge.getAuthorizedPages === 'function') screens = bridge.getAuthorizedPages() ?? null;
      else if (Array.isArray(bridge.screens)) screens = bridge.screens;
      else if (Array.isArray(bridge.pages)) screens = bridge.pages;

      this.telemetry?.logBridge('listScreens', undefined, { count: screens?.length ?? 0 });
      return screens;
    } catch (err) {
      console.warn('[ErpBridge] listScreens failed:', err);
      this.telemetry?.logBridge('listScreens', undefined, null, err);
      return null;
    }
  }

  /**
   * Checks if host ERP indicates active screen is busy with background HTTP requests or defer loading.
   */
  isPageBusy(): boolean {
    if (!this.isAvailable || typeof window.DynamicERP!.isPageBusy !== 'function') return false;
    try {
      const busy = !!window.DynamicERP!.isPageBusy();
      if (busy) {
        this.telemetry?.log('BRIDGE', 'DynamicERP.isPageBusy() -> true', undefined, 'DEBUG');
      }
      return busy;
    } catch {
      return false;
    }
  }

  /** Returns true if the bridge call completed without error and was not rejected by host. */
  async navigateToScreen(screenNameOrId: string | number): Promise<boolean> {
    return this.invoke('navigateToScreen', () => window.DynamicERP!.navigateToScreen(screenNameOrId), { screen: screenNameOrId });
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
      this.telemetry?.logBridge('submitActiveForm', undefined, false, 'Bridge not available');
      return { success: false, errors: ['جسر الـ ERP غير متاح في هذه البيئة.'] };
    }
    try {
      const raw = await window.DynamicERP!.submitActiveForm();
      if (raw && typeof raw === 'object') {
        const obj = raw as any;
        const result: ErpSaveResult = {
          success: obj.success !== false,
          docId: obj.docId || obj.id,
          errors: Array.isArray(obj.errors) ? obj.errors : undefined,
          message: obj.message
        };
        this.telemetry?.logBridge('submitActiveForm', undefined, result);
        return result;
      }
      if (raw === false) {
        this.telemetry?.logBridge('submitActiveForm', undefined, false, 'ERP returned false');
        return { success: false, errors: ['فشل الحفظ في نظام الـ ERP.'] };
      }
      this.telemetry?.logBridge('submitActiveForm', undefined, true);
      return { success: true };
    } catch (err: any) {
      console.warn('[ErpBridge] submitActiveForm failed:', err);
      this.telemetry?.logBridge('submitActiveForm', undefined, null, err);
      return {
        success: false,
        errors: [err?.message || 'حدث خطأ أثناء تنفيذ الحفظ في نظام الـ ERP.']
      };
    }
  }

  /**
   * Directly populates form state and grid rows via the official host ERP bridge.
   * Leverages in-memory binding (excelObject / dataObject) without fragile DOM scraping.
   */
  async fillFormData(payload: ErpFormFillPayload): Promise<boolean> {
    if (!this.isAvailable || typeof window.DynamicERP!.fillFormData !== 'function') {
      return false;
    }
    return this.invoke('fillFormData', () => window.DynamicERP!.fillFormData!(payload), {
      fieldsCount: Object.keys(payload.fields || {}).length,
      rowsCount: payload.rows?.length || 0
    });
  }

  /**
   * Directly checks if the host ERP indicates an active transaction or document form is currently open.
   */
  getActiveFormContext(): ErpActiveFormContext | null {
    if (!this.isAvailable || typeof window.DynamicERP!.getActiveFormContext !== 'function') {
      return null;
    }
    try {
      const ctx = window.DynamicERP!.getActiveFormContext() || null;
      this.telemetry?.logBridge('getActiveFormContext', undefined, ctx);
      return ctx;
    } catch {
      return null;
    }
  }

  private async invoke(name: string, call: () => unknown, args?: any): Promise<boolean> {
    if (!this.isAvailable) {
      this.telemetry?.logBridge(name, args, false, 'Bridge not available');
      return false;
    }
    try {
      const res = await call();
      if (res === false) {
        console.warn(`[ErpBridge] ${name} returned false from host.`);
        this.telemetry?.logBridge(name, args, false);
        return false;
      }
      this.telemetry?.logBridge(name, args, true);
      return true;
    } catch (err) {
      console.warn(`[ErpBridge] ${name} failed:`, err);
      this.telemetry?.logBridge(name, args, false, err);
      return false;
    }
  }
}
