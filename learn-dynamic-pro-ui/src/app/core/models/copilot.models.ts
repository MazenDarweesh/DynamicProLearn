import { ErpBatchItem } from './erp-form.models';

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
  fields?: Record<string, any>;
  rows?: Record<string, any>[];
  screenKey?: string;
  pageId?: number | string;
  documentName?: string;
  batch_mode?: boolean;
  batch_items?: ErpBatchItem[];
  missing_required?: { key: string; label: string }[];
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
