using LearnDynamicPro.Application.Dtos.Assignments;

namespace LearnDynamicPro.Application.Features.Admin;

public interface IAssignmentService
{
    // Assign modules with level & type filters to departments
    Task<DepartmentModuleDto> AssignModuleToDepartmentAsync(AssignModuleRequest request);
    Task RemoveAssignmentAsync(Guid assignmentId);
    Task<List<DepartmentModuleDto>> GetAssignmentsByDepartmentAsync(Guid departmentId);
}
