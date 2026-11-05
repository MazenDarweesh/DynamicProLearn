export interface ModuleDto {
  id: string;
  name: string;
  description: string;
}

export interface UnitDto {
  id: string;
  title: string;
  orderIndex: number;
}

export interface LessonDto {
  id: string;
  unitId: string;
  title: string;
  levelLabel: string;
  typeLabel: string;
  orderIndex: number;
  levelOrderIndex: number;
  levelSortOrder: number;
  isCompleted: boolean;
  hasQuiz?: boolean;
  hasSummary?: boolean;
  pdfUrl?: string;
  externalLink?: string;
  erpKey?: string;
}

export interface LessonDetailDto extends LessonDto {
  videoUrl: string;
  pdfUrl?: string;
  externalLink?: string;
}

export interface StudentQuizOptionDto {
  optionId: string;
  text: string;
}

export interface StudentQuizQuestionDto {
  questionNumber: number;
  questionText: string;
  options: StudentQuizOptionDto[];
}

export interface StudentLessonQuizDto {
  lessonId: string;
  questions: StudentQuizQuestionDto[];
}

export interface StudentSummaryTopicDto {
  topicName: string;
  explanation: string;
  keyPoints: string[];
}

export interface StudentLessonSummaryDto {
  lessonId: string;
  overview: string;
  topics: StudentSummaryTopicDto[];
}

export interface CheckQuizAnswerRequest {
  questionNumber: number;
  selectedOptionId: string;
}

export interface QuestionEvaluationResultDto {
  questionNumber: number;
  selectedOptionId: string;
  isCorrect: boolean;
  correctAnswerId: string;
  explanation: string;
}

export interface StudentQuizStateDto {
  lessonId: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  scorePercentage: number;
  isCompleted: boolean;
  completedAt?: string | null;
  answeredQuestions: QuestionEvaluationResultDto[];
}

export interface SubmitQuizRequest {
  answers?: CheckQuizAnswerRequest[];
}

export interface QuizSubmissionResultDto {
  totalQuestions: number;
  correctCount: number;
  scorePercentage: number;
  passed: boolean;
  results: QuestionEvaluationResultDto[];
}
