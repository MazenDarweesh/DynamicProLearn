/**
 * Contract of the official ERP bridge exposed on `window.DynamicERP`
 * by the host DynamicPro ERP frontend.
 */
export interface ErpActiveScreen {
  pageId: number;
  pageName: string;
}

export interface ErpScreenInfo {
  pageName: string;
  title: string;
  module?: string;
}

export interface DynamicErpBridge {
  getActiveScreen(): ErpActiveScreen | null | undefined;
  navigateToScreen(screenName: string): Promise<unknown> | unknown;
  triggerAddNew(): Promise<unknown> | unknown;
  submitActiveForm(): Promise<unknown> | unknown;
  /** Optional: not yet confirmed with the ERP team. */
  listScreens?(): ErpScreenInfo[];
}

declare global {
  interface Window {
    DynamicERP?: DynamicErpBridge;
  }
}
