using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Application.Features.Admin;

public class AssignmentService : IAssignmentService
{
    private readonly IApplicationDbContext _context;

    public AssignmentService(IApplicationDbContext context)
    {
        _context = context;
    }

    public Task<DepartmentModuleDto> AssignModuleToDepartmentAsync(AssignModuleRequest request) => throw new NotImplementedException();
    public Task RemoveAssignmentAsync(Guid assignmentId) => throw new NotImplementedException();
    public Task<List<DepartmentModuleDto>> GetAssignmentsByDepartmentAsync(Guid departmentId) => throw new NotImplementedException();
}
