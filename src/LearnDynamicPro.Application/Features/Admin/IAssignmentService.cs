using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface IAssignmentService
{
    // Assign modules with level & type filters to departments
    Task<Result<DepartmentModuleDto>> AssignModuleToDepartmentAsync(AssignModuleRequest request);
    Task<Result> RemoveAssignmentAsync(Guid assignmentId);
    Task<Result<PagedList<DepartmentModuleDto>>> GetAssignmentsByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 10);
}
