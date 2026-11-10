/**
 * Model definitions for ERP Form Inspection and Driver (Blueprint: المسار 2)
 */

export type FieldKind =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'mat-select'
  | 'ng-select'
  | 'autocomplete'
  | 'grid-cell';

export type FieldGroup = 'header' | 'grid' | 'footer';

export interface FormFieldSchema {
  key: string;              // Technical name or identifier (e.g., 'SupplierName', 'c.ColumnName', 'phone')
  label: string;            // Human-readable label (e.g., 'المورد', 'الاسم', 'رقم الهاتف')
  kind: FieldKind;
  group: FieldGroup;
  rowIndex?: number;
  colHeader?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  options?: string[];
  placeholder?: string;
}

export type FillFieldStatus = 'filled' | 'ambiguous' | 'not_found' | 'skipped_disabled';

export interface FormFillResult {
  field: string;
  label?: string;
  status: FillFieldStatus;
  value?: any;
  suggestions?: string[];
  message?: string;
}

export interface FormFillExecutionReport {
  success: boolean;
  fieldsProcessed: number;
  filledCount: number;
  results: FormFillResult[];
}

export interface ErpBatchItem {
  id?: string;
  title?: string;
  fields: Record<string, any>;
  rows?: Record<string, any>[];
  status?: 'pending' | 'filling' | 'completed' | 'skipped' | 'failed';
  report?: FormFillExecutionReport;
  error?: string;
}

export type BatchStepStatus = 'idle' | 'navigating' | 'filling' | 'waiting_confirm' | 'paused' | 'completed' | 'cancelled';

export interface ErpBatchState {
  total: number;
  currentIndex: number;
  status: BatchStepStatus;
  items: ErpBatchItem[];
  autoAdvance: boolean;
  screenKey?: string;
}

// ─────────────────────────────────────────────────────────────
// ERP Autonomous Navigation & Progressive Leftover Contracts
// (Matches backend Pydantic models in LMS_CO_Pilot/src/models/erp_models.py)
// ─────────────────────────────────────────────────────────────

export interface NavCandidateIn {
  id: string;
  label: string;
  path: string[];
}

export interface NavRequest {
  user_message: string;
  candidates: NavCandidateIn[];
  current_path?: string[];
}

export interface NavScored {
  id: string;
  confidence: number;
  reason: string;
}

export type ErpIntent = 'question' | 'navigate' | 'action' | 'unknown';

export interface NavResolution {
  decision: 'go' | 'ask' | 'clarify';
  candidates: NavScored[];
  intent?: ErpIntent;
  source?: 'ai' | 'memory' | 'lexical';
  decision_id?: string | null;
}

export interface ControlIn {
  id: string;
  label: string;
}

export interface ControlRolesRequest {
  screen_id: string;
  controls: ControlIn[];
}

export interface ControlRolesResponse {
  roles: Record<string, string>;
  source: 'ai' | 'memory';
}

export interface NavFeedbackRequest {
  decision_id: string;
  outcome: 'applied' | 'rejected';
}

export interface FieldSignatureIn {
  key: string;
  label?: string;
  kind: string;
  disabled?: boolean;
  options?: string[];
}

export interface LeftoverRequest {
  user_message: string;
  extracted_data: Record<string, any>;
  filled: Record<string, any>;
  new_fields: FieldSignatureIn[];
}

export interface LeftoverResponse {
  fields: Record<string, any>;
  ask_user: string[];
}

export interface GridFillOptions {
  excludeContainer?: HTMLElement;
  resultsOut?: FormFillResult[];
  telemetry?: any;
  copilotService?: any;
}

/** Field- or row-level change summary shown before confirming updates to an already-saved document. */
export interface ErpFormDiffEntry {
  key: string;
  label: string;
  before: string;
  after: string;
  scope: 'header' | 'row';
  rowIndex?: number;
  kind: 'added' | 'changed' | 'cleared';
}


