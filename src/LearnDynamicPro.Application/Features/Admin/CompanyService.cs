using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Admin;

public class CompanyService : ICompanyService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public CompanyService(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<CompanyDto> CreateCompanyAsync(CreateCompanyRequest request)
    {
        var company = new Company { Name = request.Name };
        _context.Companies.Add(company);
        await _context.SaveChangesAsync(default);

        return new CompanyDto { Id = company.Id, Name = company.Name };
    }

    public async Task<List<CompanyDto>> GetAllCompaniesAsync()
    {
        return await _context.Companies
            .AsNoTracking()
            .Select(c => new CompanyDto { Id = c.Id, Name = c.Name })
            .ToListAsync();
    }

    public async Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request)
    {
        var department = new Department 
        { 
            Name = request.Name, 
            CompanyId = request.CompanyId 
        };
        _context.Departments.Add(department);
        await _context.SaveChangesAsync(default);

        return new DepartmentDto 
        { 
            Id = department.Id, 
            Name = department.Name, 
            CompanyId = department.CompanyId 
        };
    }

    public async Task<List<DepartmentDto>> GetDepartmentsByCompanyAsync(Guid companyId)
    {
        return await _context.Departments
            .AsNoTracking()
            .Where(d => d.CompanyId == companyId)
            .Select(d => new DepartmentDto { Id = d.Id, Name = d.Name, CompanyId = d.CompanyId })
            .ToListAsync();
    }

    public async Task<UserDto> CreateUserAsync(CreateUserRequest request)
    {
        // Get department to resolve CompanyId
        var department = await _context.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == request.DepartmentId);
            
        if (department == null)
            throw new KeyNotFoundException("Department not found");

        var user = new User
        {
            Username = request.Username,
            PasswordHash = _passwordHasher.Hash(request.Password),
            Role = request.Role,
            DepartmentId = department.Id,
            CompanyId = department.CompanyId
        };
        
        _context.Users.Add(user);
        await _context.SaveChangesAsync(default);

        return new UserDto 
        { 
            Id = user.Id, 
            Username = user.Username, 
            Role = user.Role, 
            DepartmentId = user.DepartmentId,
            CompanyId = user.CompanyId 
        };
    }

    public async Task<List<UserDto>> GetUsersByDepartmentAsync(Guid departmentId)
    {
        return await _context.Users
            .AsNoTracking()
            .Where(u => u.DepartmentId == departmentId)
            .Select(u => new UserDto 
            { 
                Id = u.Id, 
                Username = u.Username, 
                Role = u.Role, 
                DepartmentId = u.DepartmentId,
                CompanyId = u.CompanyId 
            })
            .ToListAsync();
    }
}

