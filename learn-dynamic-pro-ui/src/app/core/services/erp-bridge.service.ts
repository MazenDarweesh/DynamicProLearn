import { Injectable } from '@angular/core';
import { ErpActiveScreen, ErpScreenInfo } from '../models/erp-bridge.models';

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

  /** Returns true if the bridge call completed without error. */
  async navigateToScreen(screenName: string): Promise<boolean> {
    return this.invoke('navigateToScreen', () => window.DynamicERP!.navigateToScreen(screenName));
  }

  /** Returns true if the bridge call completed without error. */
  async triggerAddNew(): Promise<boolean> {
    return this.invoke('triggerAddNew', () => window.DynamicERP!.triggerAddNew());
  }

  /** Must only be called after explicit user confirmation. */
  async submitActiveForm(): Promise<boolean> {
    return this.invoke('submitActiveForm', () => window.DynamicERP!.submitActiveForm());
  }

  private async invoke(name: string, call: () => unknown): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      await call();
      return true;
    } catch (err) {
      console.warn(`[ErpBridge] ${name} failed:`, err);
      return false;
    }
  }
}
