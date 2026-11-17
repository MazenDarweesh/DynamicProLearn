import { ErpBatchItem, NavCandidateIn, NavScored } from './erp-form.models';

export interface CopilotSource {
  type?: 'video' | 'pdf' | string;
  url?: string;
  start?: number;
  end?: number;
  page?: number | null;
  section?: string | null;
  lesson_id?: string;
  title?: string;
  lesson_title?: string;
  timestamp?: string;
  video_url?: string;
  relevance_score?: number;
}

export interface CopilotFormFillData {
  intent?: string;
  /** Semantic document intent produced by the Extractor (`new` creates blank doc, `edit_current` updates active doc). */
  action_intent?: 'new' | 'edit_current';
  fields?: Record<string, any>;
  rows?: Record<string, any>[];
  screenKey?: string;
  pageId?: number | string;
  documentName?: string;
  batch_mode?: boolean;
  batch_items?: ErpBatchItem[];
  missing_required?: { key: string; label: string }[];
  paid_amount?: number | null;
  paid_cash?: boolean;
}

export interface CopilotFilterState {
  scope: 'all' | 'module' | 'unit' | 'lesson' | 'lessons';
  moduleId?: string;
  unitId?: string;
  lessonId?: string;
  lessonIds?: string[];
  levelId?: string;
  typeId?: string;
}

export interface AgentStepItem {
  step: number;
  status: 'connecting' | 'connected' | 'observing' | 'acting' | 'completed' | 'error';
  message: string;
  thought?: string;
  action?: string;
  coordinate?: [number, number];
  text?: string;
}

export interface CopilotFeedbackRequest {
  query: string;
  answer: string;
  rating: 'UP' | 'DOWN' | 'up' | 'down' | string;
  comment?: string;
  lesson_id?: string;
  thread_id?: string;
  sources?: any[];
}

export interface AiReadinessResponse {
  status: string;
  ready: boolean;
  startup_duration_seconds?: number;
  gemini_model?: string;
  environment?: string;
}

export interface CopilotFilterOption {
  id: string;
  name: string;
  sortOrder: number;
}

export interface CopilotFilterLesson {
  id: string;
  title: string;
  levelId: string;
  typeId: string;
  erpKey?: string;
}

export interface CopilotFilterUnit {
  id: string;
  title: string;
  lessons: CopilotFilterLesson[];
}

export interface CopilotFilterModule {
  id: string;
  title: string;
  code: string;
  units: CopilotFilterUnit[];
}

export interface StudentCopilotFilterData {
  modules: CopilotFilterModule[];
  levels: CopilotFilterOption[];
  types: CopilotFilterOption[];
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GeneralChatNavAction {
  decision?: 'go' | 'ask' | 'clarify' | string;
  screen?: string;
  pageId?: number | string;
  page_id?: number | string;
  screenKey?: string;
  screen_key?: string;
  label?: string;
  reason?: string;
  candidates?: NavScored[];
}

export interface GeneralChatToolEvent {
  type: 'tool_start' | 'tool_end';
  tool?: string;
  name?: string;
  input?: any;
  output?: any;
  [key: string]: any;
}

export interface GeneralChatDoneMeta {
  thread_id?: string;
  trace_id?: string;
  mcp_enabled?: boolean;
  provider?: string;
  model?: string;
  latency_ms?: number;
  metrics?: {
    ttftMs?: number | null;
    streamDurationMs?: number;
    tokenCount?: number;
    total_latency_ms?: number;
  };
  [key: string]: any;
}

export interface GeneralChatStreamParams {
  query: string;
  history?: ChatHistoryMessage[];
  threadId?: string;
  erpKey?: string;
  activeScreenKey?: string;
  lessonId?: string;
  lessonIds?: string[];
  candidates?: NavCandidateIn[];
  traceId?: string;
  onSources?: (sources: CopilotSource[]) => void;
  onToken?: (token: string) => void;
  onNavAction?: (action: GeneralChatNavAction) => void;
  onToolEvent?: (event: GeneralChatToolEvent) => void;
  onDone?: (meta?: GeneralChatDoneMeta) => void;
  onError?: (err: any) => void;
}
