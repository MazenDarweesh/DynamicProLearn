using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface IModuleService
{
    // Module CRUD
    Task<Result<ModuleDto>> CreateModuleAsync(CreateModuleRequest request);
    Task<Result<ModuleDto>> UpdateModuleAsync(Guid id, UpdateModuleRequest request);
    Task<Result> DeleteModuleAsync(Guid id);
    Task<Result<PagedList<ModuleDto>>> GetAllModulesAsync(int page = 1, int pageSize = 10);

    // Unit CRUD
    Task<Result<UnitDto>> CreateUnitAsync(CreateUnitRequest request);
    Task<Result<UnitDto>> UpdateUnitAsync(Guid id, UpdateUnitRequest request);
    Task<Result> DeleteUnitAsync(Guid id);
    Task<Result<PagedList<UnitDto>>> GetUnitsByModuleAsync(Guid moduleId, int page = 1, int pageSize = 10);

    // Lesson CRUD
    Task<Result<LessonDto>> CreateLessonAsync(CreateLessonRequest request);
    Task<Result<LessonDto>> UpdateLessonAsync(Guid id, UpdateLessonRequest request);
    Task<Result> DeleteLessonAsync(Guid id);
    Task<Result<PagedList<LessonDto>>> GetLessonsByUnitAsync(Guid unitId, int page = 1, int pageSize = 10);
    Task<Result<LessonDetailDto>> GetLessonDetailAsync(Guid lessonId);
}
