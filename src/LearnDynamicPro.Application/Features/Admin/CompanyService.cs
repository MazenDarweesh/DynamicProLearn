using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
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

    public async Task<Result<CompanyDto>> CreateCompanyAsync(CreateCompanyRequest request)
    {
        var company = new Company { Name = request.Name };
        _context.Companies.Add(company);
        await _context.SaveChangesAsync(default);

        return Result<CompanyDto>.Success(new CompanyDto { Id = company.Id, Name = company.Name });
    }

    public async Task<Result<PagedList<CompanyDto>>> GetAllCompaniesAsync(int page = 1, int pageSize = 100)
    {
        var query = _context.Companies.AsNoTracking();
        var totalCount = await query.CountAsync();

        var companies = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CompanyDto { Id = c.Id, Name = c.Name })
            .ToListAsync();
            
        var pagedList = new PagedList<CompanyDto>(companies, totalCount, page, pageSize);
        return Result<PagedList<CompanyDto>>.Success(pagedList);
    }

    public async Task<Result<DepartmentDto>> CreateDepartmentAsync(CreateDepartmentRequest request)
    {
        var department = new Department 
        { 
            Name = request.Name, 
            CompanyId = request.CompanyId 
        };
        _context.Departments.Add(department);
        await _context.SaveChangesAsync(default);

        return Result<DepartmentDto>.Success(new DepartmentDto 
        { 
            Id = department.Id, 
            Name = department.Name, 
            CompanyId = department.CompanyId 
        });
    }

    public async Task<Result<PagedList<DepartmentDto>>> GetDepartmentsByCompanyAsync(Guid companyId, int page = 1, int pageSize = 100)
    {
        var query = _context.Departments
            .AsNoTracking()
            .Where(d => d.CompanyId == companyId);
            
        var totalCount = await query.CountAsync();

        var departments = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new DepartmentDto { Id = d.Id, Name = d.Name, CompanyId = d.CompanyId })
            .ToListAsync();
            
        var pagedList = new PagedList<DepartmentDto>(departments, totalCount, page, pageSize);
        return Result<PagedList<DepartmentDto>>.Success(pagedList);
    }

    public async Task<Result<UserDto>> CreateUserAsync(CreateUserRequest request)
    {
        // Get department to resolve CompanyId
        var department = await _context.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == request.DepartmentId);
            
        if (department == null)
            return Result<UserDto>.Failure(AppErrors.General.NotFound);

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

        return Result<UserDto>.Success(new UserDto 
        { 
            Id = user.Id, 
            Username = user.Username, 
            Role = user.Role, 
            DepartmentId = user.DepartmentId,
            CompanyId = user.CompanyId 
        });
    }

    public async Task<Result<PagedList<UserDto>>> GetUsersByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 100)
    {
        var query = _context.Users
            .AsNoTracking()
            .Where(u => u.DepartmentId == departmentId);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto 
            { 
                Id = u.Id, 
                Username = u.Username, 
                Role = u.Role, 
                DepartmentId = u.DepartmentId,
                CompanyId = u.CompanyId 
            })
            .ToListAsync();
            
        var pagedList = new PagedList<UserDto>(users, totalCount, page, pageSize);
        return Result<PagedList<UserDto>>.Success(pagedList);
    }

    public async Task<Result<bool>> UpdateCompanyAsync(Guid id, UpdateCompanyRequest request)
    {
        var company = await _context.Companies.FindAsync(id);
        if (company == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        company.Name = request.Name;
        await _context.SaveChangesAsync(default);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteCompanyAsync(Guid id)
    {
        var company = await _context.Companies.FindAsync(id);
        if (company == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        _context.Companies.Remove(company);
        await _context.SaveChangesAsync(default);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        department.Name = request.Name;
        await _context.SaveChangesAsync(default);
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteDepartmentAsync(Guid id)
    {
        var department = await _context.Departments.FindAsync(id);
        if (department == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        _context.Departments.Remove(department);
        await _context.SaveChangesAsync(default);
        return Result<bool>.Success(true);
    }

    public async Task<Result<PagedList<UserProgressDto>>> GetDepartmentUsersProgressAsync(Guid departmentId, int page = 1, int pageSize = 100)
    {
        // Get all users in department
        var query = _context.Users
            .AsNoTracking()
            .Where(u => u.DepartmentId == departmentId);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Get assigned modules for department
        var assignments = await _context.DepartmentModuleAssignments
            .AsNoTracking()
            .Include(a => a.Module)
                .ThenInclude(m => m.Units)
                    .ThenInclude(u => u.Lessons)
            .Where(a => a.DepartmentId == departmentId)
            .ToListAsync();

        var assignedModulesNames = string.Join(", ", assignments.Select(a => a.Module.Name));
        
        // Calculate total lessons in all assigned modules
        var totalLessons = assignments
            .SelectMany(a => a.Module.Units)
            .SelectMany(u => u.Lessons)
            .Count();

        var lessonIds = assignments
            .SelectMany(a => a.Module.Units)
            .SelectMany(u => u.Lessons)
            .Select(l => l.Id)
            .ToList();

        // Get completed lessons for all these users
        var userIds = users.Select(u => u.Id).ToList();
        var completions = await _context.LessonProgresses
            .AsNoTracking()
            .Where(p => userIds.Contains(p.UserId) && p.IsCompleted && lessonIds.Contains(p.LessonId))
            .ToListAsync();

        var progressList = users.Select(u => {
            var completedCount = completions.Count(c => c.UserId == u.Id);
            return new UserProgressDto
            {
                UserId = u.Id,
                UserName = u.Username,
                Role = u.Role.ToString(),
                AssignedModules = string.IsNullOrEmpty(assignedModulesNames) ? "لا يوجد" : assignedModulesNames,
                CompletedLessons = completedCount,
                TotalLessons = totalLessons
            };
        }).ToList();

        var pagedList = new PagedList<UserProgressDto>(progressList, totalCount, page, pageSize);
        return Result<PagedList<UserProgressDto>>.Success(pagedList);
    }

    public async Task<Result<DashboardStatsDto>> GetDashboardStatsAsync()
    {
        var totalCompanies = await _context.Companies.CountAsync();
        var activeUsers = await _context.Users.CountAsync();
        var publishedModules = await _context.Modules.CountAsync();

        // Average progress = total completions / total assigned lessons across everyone
        // For simplicity, we can calculate total possible vs total completed.
        // A more exact metric would need user-assignment mapping.
        // Let's do a fast approximation:
        var totalAssignments = await _context.DepartmentModuleAssignments
            .Include(a => a.Department)
                .ThenInclude(d => d.Users)
            .Include(a => a.Module)
                .ThenInclude(m => m.Units)
                    .ThenInclude(u => u.Lessons)
            .ToListAsync();

        int totalPossibleLessons = 0;
        foreach(var assignment in totalAssignments)
        {
            var userCount = assignment.Department.Users.Count;
            var lessonCount = assignment.Module.Units.SelectMany(u => u.Lessons).Count();
            totalPossibleLessons += userCount * lessonCount;
        }

        int totalCompleted = await _context.LessonProgresses.CountAsync(p => p.IsCompleted);

        double averageProgress = totalPossibleLessons == 0 
            ? 0 
            : Math.Round((double)totalCompleted / totalPossibleLessons * 100, 1);

        return Result<DashboardStatsDto>.Success(new DashboardStatsDto
        {
            TotalCompanies = totalCompanies,
            ActiveUsers = activeUsers,
            PublishedModules = publishedModules,
            AverageProgress = averageProgress
        });
    }
}

