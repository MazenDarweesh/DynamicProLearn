/**
 * Contract of the official ERP bridge exposed on `window.DynamicERP`
 * by the host DynamicPro ERP frontend.
 */
export interface ErpActiveScreen {
  pageId: number;
  pageName: string;
  title?: string;
  screenKey?: string;
}

export interface ErpScreenInfo {
  pageId?: number;
  pageName: string;
  title: string;
  moduleId?: number;
  moduleName?: string;
  module?: string;
  screenKey?: string;
}

export interface ErpMissingFieldInfo {
  key: string;
  label: string;
  kind: string;
  options?: string[];
  reason?: string;
}

export interface ErpSaveResult {
  /** `true` only when `outcome === 'saved'` (positive evidence of a persisted document). */
  success: boolean;
  /**
   * - `saved`: success toast / document id / form closed-or-cleared after the click.
   * - `failed`: an error toast or a bridge/server error was captured.
   * - `unconfirmed`: the click was dispatched but no evidence either way was observed.
   */
  outcome?: 'saved' | 'failed' | 'unconfirmed';
  docId?: string | number;
  poId?: string | number;
  poNumber?: string | number;
  errors?: string[];
  message?: string;
  missingFields?: ErpMissingFieldInfo[];
  subMenuClicked?: string;
}

export interface ErpFormFillPayload {
  fields: Record<string, any>;
  rows?: Array<Record<string, any>>;
}

export type ErpFormMode = 'ClosedOrList' | 'EmptyNew' | 'UnsavedDraft' | 'SavedOpen';

export interface ErpFormStateSnapshot {
  isOpen?: boolean;
  /** Host-reported lifecycle mode (e.g. 'closed', 'list', 'new', 'draft', 'saved', 'edit') */
  mode?: string;
  isSaved?: boolean;
  isNew?: boolean;
  dirty?: boolean;
  isDirty?: boolean;
  docId?: string | number | null;
  docNumber?: string | number | null;
  screenKey?: string;
  screenName?: string;
}

export interface ErpActiveFormContext {
  isOpen: boolean;
  screenKey?: string;
  screenName?: string;
  isInvoice?: boolean;
  formType?: string;
  dataObject?: Record<string, any> | null;
  rows?: Array<Record<string, any>> | null;
}

export interface ErpBridgeCapabilities {
  /** Host contract version used for v2.5.0 feature detection (never read `version`). */
  contractVersion?: string;
  version?: string;
  supportedScreens?: number[];
  [key: string]: unknown;
}

export interface ErpRawLookupResponse {
  status: 'ok' | 'loaded' | 'not_loaded' | 'empty' | string;
  data: unknown;
  count?: number;
}

export interface ErpLookupFieldSpec {
  field: string;
  labelAr: string;
  scope: 'header' | 'row';
  droModel: string;
  valueKey: string;
  textKey: string;
}

export interface ErpLookupOption {
  id: string | number;
  label: string;
  raw: Record<string, unknown>;
}

export type StrictLookupFetchStatus =
  | 'ok'
  | 'unsupported'
  | 'not_loaded'
  | 'empty'
  | 'invalid_row_schema'
  | 'error';

export interface StrictLookupFetchResult {
  status: StrictLookupFetchStatus;
  options: ErpLookupOption[];
  totalCount: number;
  invalidRows: number;
  attempts: number;
  errorMessage?: string;
}

export interface ErpSelectLookupResult {
  ok: boolean;
  reason?: string;
}

export interface ErpTableRowPayload {
  ProductID: string | number;
  Qty: number;
  Price?: number;
  UnitID?: string | number;
  StoreID?: string | number;
  Note?: string;
}

export interface ErpClearTableRowsResult {
  ok: boolean;
  count: number;
  reason?: string;
}

export interface ErpAddTableRowResult {
  ok: boolean;
  reason?: string;
  raw?: unknown;
}

export interface ErpSaveDocumentOptions {
  expectedPOID?: string | number;
  expectedPONumber?: string | number;
}

export interface ErpSaveDocumentResult {
  ok: boolean;
  POID?: string | number;
  PONumber?: string | number;
  mode?: string;
  errors?: string[];
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
  /** Structured host form lifecycle inspection (mode/dirty/docId) */
  getFormState?(): ErpFormStateSnapshot | null;
  /** Host bridge v2.5.0 capability handshake (feature detection reads `contractVersion` only). */
  getCapabilities?(): ErpBridgeCapabilities | null;
  /** Host bridge v2.5.0 lookup dataset fetcher (`{ status, data, count }`). */
  fetchLookupData?(droModel: string): Promise<ErpRawLookupResponse> | ErpRawLookupResponse;
  /** Host bridge v2.5.0 table row reset action. */
  clearTableRows?(): Promise<ErpClearTableRowsResult> | ErpClearTableRowsResult;
  /** Host bridge v2.5.0 deterministic lookup selection by ID. */
  selectLookup?(
    fieldKey: string,
    id: string | number
  ): Promise<ErpSelectLookupResult> | ErpSelectLookupResult;
  /** Host bridge v2.5.0 structured line-item insertion. */
  addTableRow?(row: ErpTableRowPayload): Promise<ErpAddTableRowResult | boolean | void> | ErpAddTableRowResult | boolean | void;
  /** Host bridge v2.5.0 document persistence with POID/PONumber output. */
  saveDocument?(
    options?: ErpSaveDocumentOptions
  ): Promise<ErpSaveDocumentResult> | ErpSaveDocumentResult;
}

declare global {
  interface Window {
    DynamicERP?: DynamicErpBridge;
  }
}

