using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface ICompanyService
{
    // Company CRUD
    Task<Result<CompanyDto>> CreateCompanyAsync(CreateCompanyRequest request);
    Task<Result<List<CompanyDto>>> GetAllCompaniesAsync();

    // Department CRUD
    Task<Result<DepartmentDto>> CreateDepartmentAsync(CreateDepartmentRequest request);
    Task<Result<List<DepartmentDto>>> GetDepartmentsByCompanyAsync(Guid companyId);

    // User CRUD
    Task<Result<UserDto>> CreateUserAsync(CreateUserRequest request);
    Task<Result<List<UserDto>>> GetUsersByDepartmentAsync(Guid departmentId);
}
