using LearnDynamicPro.Application.Dtos.Modules;

namespace LearnDynamicPro.Application.Features.Modules;

public interface IModuleService
{
    // Module CRUD
    Task<ModuleDto> CreateModuleAsync(CreateModuleRequest request);
    Task<ModuleDto> UpdateModuleAsync(Guid id, UpdateModuleRequest request);
    Task DeleteModuleAsync(Guid id);
    Task<List<ModuleDto>> GetAllModulesAsync();

    // Unit CRUD
    Task<UnitDto> CreateUnitAsync(CreateUnitRequest request);
    Task<UnitDto> UpdateUnitAsync(Guid id, UpdateUnitRequest request);
    Task DeleteUnitAsync(Guid id);
    Task<List<UnitDto>> GetUnitsByModuleAsync(Guid moduleId);

    // Lesson CRUD
    Task<LessonDto> CreateLessonAsync(CreateLessonRequest request);
    Task<LessonDto> UpdateLessonAsync(Guid id, UpdateLessonRequest request);
    Task DeleteLessonAsync(Guid id);
    Task<List<LessonDto>> GetLessonsByUnitAsync(Guid unitId);
    Task<LessonDetailDto> GetLessonDetailAsync(Guid lessonId);
}
