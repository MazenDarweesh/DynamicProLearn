using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface ICompanyService
{
    // Company CRUD
    Task<Result<CompanyDto>> CreateCompanyAsync(CreateCompanyRequest request);
    Task<Result<PagedList<CompanyDto>>> GetAllCompaniesAsync(int page = 1, int pageSize = 100);
    Task<Result<bool>> UpdateCompanyAsync(Guid id, UpdateCompanyRequest request);
    Task<Result<bool>> DeleteCompanyAsync(Guid id);

    // Department CRUD
    Task<Result<DepartmentDto>> CreateDepartmentAsync(CreateDepartmentRequest request);
    Task<Result<PagedList<DepartmentDto>>> GetDepartmentsByCompanyAsync(Guid companyId, int page = 1, int pageSize = 100);
    Task<Result<bool>> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request);
    Task<Result<bool>> DeleteDepartmentAsync(Guid id);

    // User CRUD
    Task<Result<UserDto>> CreateUserAsync(CreateUserRequest request);
    Task<Result<PagedList<UserDto>>> GetUsersByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 100);
    Task<Result<PagedList<UserProgressDto>>> GetDepartmentUsersProgressAsync(Guid departmentId, int page = 1, int pageSize = 100);

    // Dashboard Stats
    Task<Result<DashboardStatsDto>> GetDashboardStatsAsync();
}
