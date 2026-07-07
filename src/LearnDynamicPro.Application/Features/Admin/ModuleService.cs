using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Application.Features.Admin;

public class ModuleService : IModuleService
{
    private readonly IApplicationDbContext _context;

    public ModuleService(IApplicationDbContext context)
    {
        _context = context;
    }

    public Task<ModuleDto> CreateModuleAsync(CreateModuleRequest request) => throw new NotImplementedException();
    public Task<ModuleDto> UpdateModuleAsync(Guid id, UpdateModuleRequest request) => throw new NotImplementedException();
    public Task DeleteModuleAsync(Guid id) => throw new NotImplementedException();
    public Task<List<ModuleDto>> GetAllModulesAsync() => throw new NotImplementedException();

    public Task<UnitDto> CreateUnitAsync(CreateUnitRequest request) => throw new NotImplementedException();
    public Task<UnitDto> UpdateUnitAsync(Guid id, UpdateUnitRequest request) => throw new NotImplementedException();
    public Task DeleteUnitAsync(Guid id) => throw new NotImplementedException();
    public Task<List<UnitDto>> GetUnitsByModuleAsync(Guid moduleId) => throw new NotImplementedException();

    public Task<LessonDto> CreateLessonAsync(CreateLessonRequest request) => throw new NotImplementedException();
    public Task<LessonDto> UpdateLessonAsync(Guid id, UpdateLessonRequest request) => throw new NotImplementedException();
    public Task DeleteLessonAsync(Guid id) => throw new NotImplementedException();
    public Task<List<LessonDto>> GetLessonsByUnitAsync(Guid unitId) => throw new NotImplementedException();
    public Task<LessonDetailDto> GetLessonDetailAsync(Guid lessonId) => throw new NotImplementedException();
}
