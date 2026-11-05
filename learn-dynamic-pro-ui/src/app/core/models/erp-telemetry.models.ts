export interface TelemetryEventDetails {
  fieldsCount?: number;
  schemaDiff?: { added: string[]; removed: string[]; count: number };
  targetSelector?: string;
  attemptedValue?: any;
  availableOptions?: string[];
  fieldKey?: string;
  status?: string;
  message?: string;
  value?: any;
  rowIndex?: number;
  colMapping?: Record<string, number>;
  calculatedTotal?: string;
  args?: any;
  result?: any;
  error?: string;
  fallbackAttempted?: string;
  durationMs?: number;
  [key: string]: any;
}

export interface TelemetryEventPayload {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'NAV' | 'ERROR' | 'GENERAL' | 'SESSION_END';
  event: string;
  traceId?: string;
  durationMs?: number;
  details?: TelemetryEventDetails;
}

export interface TelemetryBatchPayload {
  session_id: string;
  screen_key?: string | null;
  trace_id?: string;
  events: TelemetryEventPayload[];
}
