using LearnDynamicPro.Application.Dtos.Companies;

namespace LearnDynamicPro.Application.Features.Tenants;

public interface ITenantService
{
    // Company CRUD (for Admin)
    Task<CompanyDto> CreateCompanyAsync(CreateCompanyRequest request);
    Task<List<CompanyDto>> GetAllCompaniesAsync();

    // Department CRUD
    Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request);
    Task<List<DepartmentDto>> GetDepartmentsByCompanyAsync(Guid companyId);

    // User CRUD
    Task<UserDto> CreateUserAsync(CreateUserRequest request);
    Task<List<UserDto>> GetUsersByDepartmentAsync(Guid departmentId);
}
