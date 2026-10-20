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

export interface ErpFormFillPayload {
  fields: Record<string, any>;
  rows?: Array<Record<string, any>>;
}

export interface ErpActiveFormContext {
  isOpen: boolean;
  screenKey?: string;
  isInvoice?: boolean;
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
  /** Direct in-memory state injection across all 700+ screens (excelObject / dataObject) */
  fillFormData?(payload: ErpFormFillPayload): Promise<boolean | void> | boolean | void;
  /** Direct inspection of active component form status */
  getActiveFormContext?(): ErpActiveFormContext | null;
}

declare global {
  interface Window {
    DynamicERP?: DynamicErpBridge;
  }
}

