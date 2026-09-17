import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private http = inject(HttpClient);
  private apiUrl = '/api/student';

  getAssignedModules(): Observable<ModuleDto[]> {
    return this.http.get<ModuleDto[]>(`${this.apiUrl}/modules`);
  }

  getProgress(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/progress`);
  }

  getModuleUnits(moduleId: string): Observable<UnitDto[]> {
    return this.http.get<UnitDto[]>(`${this.apiUrl}/modules/${moduleId}/units`);
  }

  getUnitLessons(unitId: string): Observable<LessonDto[]> {
    return this.http.get<LessonDto[]>(`${this.apiUrl}/units/${unitId}/lessons`);
  }

  getLessonDetail(lessonId: string): Observable<LessonDetailDto> {
    return this.http.get<LessonDetailDto>(`${this.apiUrl}/lessons/${lessonId}`);
  }

  completeLesson(lessonId: string, isCompleted: boolean): Observable<any> {
    return this.http.post(`${this.apiUrl}/lessons/${lessonId}/complete`, isCompleted);
  }

  getLastLesson(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/last-lesson`);
  }

  getLessonsByLevel(moduleId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/modules/${moduleId}/levels`);
  }

  getUnifiedCurriculum(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/unified-curriculum`);
  }

  getNextLesson(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/next-lesson`);
  }

  getLessonQuiz(lessonId: string): Observable<StudentLessonQuizDto> {
    return this.http.get<StudentLessonQuizDto>(`${this.apiUrl}/lessons/${lessonId}/quiz`);
  }

  getLessonSummary(lessonId: string): Observable<StudentLessonSummaryDto> {
    return this.http.get<StudentLessonSummaryDto>(`${this.apiUrl}/lessons/${lessonId}/summary`);
  }

  getQuizState(lessonId: string): Observable<StudentQuizStateDto> {
    return this.http.get<StudentQuizStateDto>(`${this.apiUrl}/lessons/${lessonId}/quiz/state`);
  }

  checkQuizAnswer(lessonId: string, req: CheckQuizAnswerRequest): Observable<QuestionEvaluationResultDto> {
    return this.http.post<QuestionEvaluationResultDto>(`${this.apiUrl}/lessons/${lessonId}/quiz/check-answer`, req);
  }

  submitQuiz(lessonId: string, req?: SubmitQuizRequest): Observable<QuizSubmissionResultDto> {
    return this.http.post<QuizSubmissionResultDto>(`${this.apiUrl}/lessons/${lessonId}/quiz/submit`, req || {});
  }

  resetQuiz(lessonId: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.apiUrl}/lessons/${lessonId}/quiz/reset`, {});
  }
}
