using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface ICompanyService
{
    // Company CRUD
    Task<Result<CompanyDto>> CreateCompanyAsync(CreateCompanyRequest request);
    Task<Result<PagedList<CompanyDto>>> GetAllCompaniesAsync(int page = 1, int pageSize = 10);
    Task<Result<bool>> UpdateCompanyAsync(Guid id, UpdateCompanyRequest request);
    Task<Result<bool>> DeleteCompanyAsync(Guid id);

    // Department CRUD
    Task<Result<DepartmentDto>> CreateDepartmentAsync(CreateDepartmentRequest request);
    Task<Result<PagedList<DepartmentDto>>> GetDepartmentsByCompanyAsync(Guid companyId, int page = 1, int pageSize = 10);
    Task<Result<bool>> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request);
    Task<Result<bool>> DeleteDepartmentAsync(Guid id);
    Task<Result<DepartmentDetailsDto>> GetDepartmentDetailsAsync(Guid departmentId);
    Task<Result<bool>> MarkLessonCompleteForDepartmentAsync(Guid departmentId, Guid lessonId);
    Task<Result<bool>> UnmarkLessonCompleteForDepartmentAsync(Guid departmentId, Guid lessonId);

    // User CRUD
    Task<Result<UserDto>> CreateUserAsync(CreateUserRequest request);
    Task<Result<PagedList<UserDto>>> GetUsersByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 10);
    Task<Result<PagedList<UserProgressDto>>> GetDepartmentUsersProgressAsync(Guid departmentId, int page = 1, int pageSize = 10);
    Task<Result<PagedList<UserProgressDto>>> GetAllUsersProgressAsync(Guid? companyId, Guid? departmentId, int page = 1, int pageSize = 10);
    Task<Result<UserDetailsDto>> GetUserDetailsAsync(Guid userId);
    Task<Result<bool>> MarkLessonCompleteForUserAsync(Guid userId, Guid lessonId);
    Task<Result<bool>> UnmarkLessonCompleteForUserAsync(Guid userId, Guid lessonId);
    Task<Result<bool>> UpdateUserAsync(Guid id, UpdateUserRequest request);
    Task<Result<bool>> DeleteUserAsync(Guid id);
    Task<Result<PagedList<UserProgressDto>>> GetAllTestersProgressAsync(int page = 1, int pageSize = 10);
    // Dashboard Stats
    Task<Result<DashboardStatsDto>> GetDashboardStatsAsync();
}
