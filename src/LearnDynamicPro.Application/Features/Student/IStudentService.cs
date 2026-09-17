using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Student;

public interface IStudentService
{
    /// <summary>Returns modules assigned to the student's department, applying Intersection (Level AND Type) filter.</summary>
    Task<Result<List<ModuleDto>>> GetAssignedModulesAsync(Guid userId);
    Task<Result<List<UnitDto>>> GetUnitsByModuleAsync(Guid moduleId);

    /// <summary>Returns lessons filtered by the assignment's Level AND Type (Intersection logic).</summary>
    Task<Result<List<LessonDto>>> GetLessonsByUnitAsync(Guid unitId, Guid userId);
    Task<Result<LessonDetailDto>> GetLessonDetailAsync(Guid lessonId, Guid userId);
    Task<Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>> GetLastAccessedLessonAsync(Guid userId);
    Task<Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>> GetLessonsByLevelAsync(Guid moduleId, Guid userId);
    Task<Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>> GetUnifiedStudentCurriculumAsync(Guid userId);
    Task<Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>> GetNextLessonToLearnAsync(Guid userId);
    
    /// <summary>Retrieves the AI-generated quiz for a lesson. Strips correct answers for students.</summary>
    Task<Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonQuizDto>> GetLessonQuizAsync(Guid lessonId, Guid userId);
    
    /// <summary>Retrieves the AI-generated summary for a lesson.</summary>
    Task<Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonSummaryDto>> GetLessonSummaryAsync(Guid lessonId, Guid userId);

    /// <summary>Gets the current persistent quiz attempt/state for a student to support cross-device resumption.</summary>
    Task<Result<LearnDynamicPro.Application.Dtos.Student.StudentQuizStateDto>> GetQuizStateAsync(Guid lessonId, Guid userId);

    /// <summary>Instantly evaluates a single quiz answer, persists the answer state, and returns the result with explanation.</summary>
    Task<Result<LearnDynamicPro.Application.Dtos.Student.QuestionEvaluationResultDto>> CheckQuizAnswerAsync(Guid lessonId, LearnDynamicPro.Application.Dtos.Student.CheckQuizAnswerRequest request, Guid userId);

    /// <summary>Finalizes a quiz attempt, calculates the final score, marks it completed, and persists to DB.</summary>
    Task<Result<LearnDynamicPro.Application.Dtos.Student.QuizSubmissionResultDto>> SubmitQuizAsync(Guid lessonId, LearnDynamicPro.Application.Dtos.Student.SubmitQuizRequest request, Guid userId);

    /// <summary>Resets a student's quiz attempt so they can retake the quiz from scratch.</summary>
    Task<Result<bool>> ResetQuizAsync(Guid lessonId, Guid userId);

    /// <summary>Returns the student's authorized hierarchy (Modules -> Units -> Lessons) along with Levels and Types for the Co-Pilot Top Filter Bar.</summary>
    Task<Result<LearnDynamicPro.Application.Dtos.Student.StudentCopilotFilterDataDto>> GetCopilotFiltersAsync(Guid userId);
}
