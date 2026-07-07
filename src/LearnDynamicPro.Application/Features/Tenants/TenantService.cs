using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Application.Features.Tenants;

public class TenantService : ITenantService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public TenantService(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public Task<CompanyDto> CreateCompanyAsync(CreateCompanyRequest request) => throw new NotImplementedException();
    public Task<List<CompanyDto>> GetAllCompaniesAsync() => throw new NotImplementedException();

    public Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request) => throw new NotImplementedException();
    public Task<List<DepartmentDto>> GetDepartmentsByCompanyAsync(Guid companyId) => throw new NotImplementedException();

    public Task<UserDto> CreateUserAsync(CreateUserRequest request) => throw new NotImplementedException();
    public Task<List<UserDto>> GetUsersByDepartmentAsync(Guid departmentId) => throw new NotImplementedException();
}
