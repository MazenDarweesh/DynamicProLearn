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

