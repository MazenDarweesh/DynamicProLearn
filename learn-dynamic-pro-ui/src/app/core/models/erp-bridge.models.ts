/**
 * Contract of the official ERP bridge exposed on `window.DynamicERP`
 * by the host DynamicPro ERP frontend.
 */
export interface ErpActiveScreen {
  pageId: number;
  pageName: string;
  title?: string;
}

export interface ErpScreenInfo {
  pageId?: number;
  pageName: string;
  title: string;
  moduleId?: number;
  moduleName?: string;
  module?: string;
}

export interface ErpSaveResult {
  success: boolean;
  docId?: string | number;
  errors?: string[];
  message?: string;
}

export interface DynamicErpBridge {
  getActiveScreen(): ErpActiveScreen | null | undefined;
  navigateToScreen(screenNameOrId: string | number): Promise<unknown> | unknown;
  triggerAddNew(): Promise<boolean | void> | boolean | void;
  submitActiveForm(): Promise<ErpSaveResult | boolean | void> | ErpSaveResult | boolean | void;
  /** Optional catalog provided by the host */
  listScreens?(): ErpScreenInfo[];
  /** Optional check if the active screen is still fetching data or busy */
  isPageBusy?(): boolean;
}

declare global {
  interface Window {
    DynamicERP?: DynamicErpBridge;
  }
}
