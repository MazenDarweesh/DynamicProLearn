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
}
