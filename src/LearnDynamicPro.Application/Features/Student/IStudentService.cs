using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Student;

public interface IStudentService
{
    /// <summary>Returns modules assigned to the student's department, applying Intersection (Level AND Type) filter.</summary>
    Task<List<ModuleDto>> GetAssignedModulesAsync(Guid userId);
    Task<List<UnitDto>> GetUnitsByModuleAsync(Guid moduleId);

    /// <summary>Returns lessons filtered by the assignment's Level AND Type (Intersection logic).</summary>
    Task<List<LessonDto>> GetLessonsByUnitAsync(Guid unitId, Guid userId);
    Task<LessonDetailDto> GetLessonDetailAsync(Guid lessonId, Guid userId);
}
