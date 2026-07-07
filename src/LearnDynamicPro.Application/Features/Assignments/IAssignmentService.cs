using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Dtos.Modules;

namespace LearnDynamicPro.Application.Features.Assignments;

public interface IAssignmentService
{
    // Assign modules with level & type filters to departments
    Task<DepartmentModuleDto> AssignModuleToDepartmentAsync(AssignModuleRequest request);
    Task RemoveAssignmentAsync(Guid assignmentId);
    Task<List<DepartmentModuleDto>> GetAssignmentsByDepartmentAsync(Guid departmentId);
    
    // Core filter: Get accessible modules for the logged-in student (applies intersection logic)
    Task<List<ModuleDto>> GetAssignedModulesForCurrentStudentAsync();
}
