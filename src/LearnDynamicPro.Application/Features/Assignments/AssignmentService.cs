using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Application.Features.Assignments;

public class AssignmentService : IAssignmentService
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public AssignmentService(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public Task<DepartmentModuleDto> AssignModuleToDepartmentAsync(AssignModuleRequest request) => throw new NotImplementedException();
    public Task RemoveAssignmentAsync(Guid assignmentId) => throw new NotImplementedException();
    public Task<List<DepartmentModuleDto>> GetAssignmentsByDepartmentAsync(Guid departmentId) => throw new NotImplementedException();
    public Task<List<ModuleDto>> GetAssignedModulesForCurrentStudentAsync() => throw new NotImplementedException();
}
