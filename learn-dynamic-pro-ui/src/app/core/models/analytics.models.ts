export interface ModuleAnalyticsDto {
  moduleId: string;
  name: string;
  description: string;
  units: UnitAnalyticsDto[];
}

export interface UnitAnalyticsDto {
  unitId: string;
  title: string;
  orderIndex: number;
  lessons: LessonAnalyticsDto[];
}

export interface LessonAnalyticsDto {
  lessonId: string;
  title: string;
  levelId: string;
  levelLabel: string;
  typeId: string;
  typeLabel: string;
  orderIndex: number;
  enrolledStudentsCount: number;
  completedStudentsCount: number;
}

export interface LessonDetailsAnalyticsDto {
  lessonId: string;
  lessonTitle: string;
  moduleName: string;
  unitName: string;
  totalCompanies: number;
  totalDepartments: number;
  totalEnrolledStudents: number;
  totalCompletedStudents: number;
  companies: CompanyLessonAnalyticsDto[];
}

export interface CompanyLessonAnalyticsDto {
  companyId: string;
  companyName: string;
  isFullyCompleted: boolean;
  departments: DepartmentLessonAnalyticsDto[];
}

export interface DepartmentLessonAnalyticsDto {
  departmentId: string;
  departmentName: string;
  isFullyCompleted: boolean;
  users: UserLessonAnalyticsDto[];
}

export interface UserLessonAnalyticsDto {
  userId: string;
  userName: string;
  isCompleted: boolean;
}
