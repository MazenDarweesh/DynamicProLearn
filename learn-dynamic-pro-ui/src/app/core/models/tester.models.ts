export interface ErpVersionDto {
  id: string;
  versionLabel: string;
}

export interface FeedbackRequest {
  lessonId: string;
  conditionOptionId: string;
  notes: string;
}

export interface LookupDto {
  id: string;
  label: string;
  sortOrder?: number;
}
