export interface TelemetryEventPayload {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  stage: 'USER_QUERY' | 'BRIDGE' | 'SCAN' | 'AI_EXTRACT' | 'FILL' | 'GRID' | 'ERROR' | 'GENERAL';
  event: string;
  details?: Record<string, any>;
}
