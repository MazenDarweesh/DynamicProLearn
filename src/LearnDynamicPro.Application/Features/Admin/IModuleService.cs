using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface IModuleService
{
    // Module CRUD
    Task<Result<ModuleDto>> CreateModuleAsync(CreateModuleRequest request);
    Task<Result<ModuleDto>> UpdateModuleAsync(Guid id, UpdateModuleRequest request);
    Task<Result> DeleteModuleAsync(Guid id);
    Task<Result<List<ModuleDto>>> GetAllModulesAsync();

    // Unit CRUD
    Task<Result<UnitDto>> CreateUnitAsync(CreateUnitRequest request);
    Task<Result<UnitDto>> UpdateUnitAsync(Guid id, UpdateUnitRequest request);
    Task<Result> DeleteUnitAsync(Guid id);
    Task<Result<List<UnitDto>>> GetUnitsByModuleAsync(Guid moduleId);

    // Lesson CRUD
    Task<Result<LessonDto>> CreateLessonAsync(CreateLessonRequest request);
    Task<Result<LessonDto>> UpdateLessonAsync(Guid id, UpdateLessonRequest request);
    Task<Result> DeleteLessonAsync(Guid id);
    Task<Result<List<LessonDto>>> GetLessonsByUnitAsync(Guid unitId);
    Task<Result<LessonDetailDto>> GetLessonDetailAsync(Guid lessonId);
}
