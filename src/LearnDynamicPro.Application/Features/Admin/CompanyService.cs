using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;

namespace LearnDynamicPro.Application.Features.Admin;

public class CompanyService : ICompanyService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;

    public CompanyService(IUnitOfWork unitOfWork, IPasswordHasher passwordHasher)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
    }

    public async Task<Result<CompanyDto>> CreateCompanyAsync(CreateCompanyRequest request)
    {
        var company = new Company { Name = request.Name };
        await _unitOfWork.Repository<Company>().AddAsync(company);
        await _unitOfWork.SaveChangesAsync();

        return Result<CompanyDto>.Success(new CompanyDto { Id = company.Id, Name = company.Name });
    }

    public async Task<Result<PagedList<CompanyDto>>> GetAllCompaniesAsync(int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Company>().Query().AsNoTracking();
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
        await _unitOfWork.Repository<Department>().AddAsync(department);
        await _unitOfWork.SaveChangesAsync();

        return Result<DepartmentDto>.Success(new DepartmentDto 
        { 
            Id = department.Id, 
            Name = department.Name, 
            CompanyId = department.CompanyId 
        });
    }

    public async Task<Result<PagedList<DepartmentDto>>> GetDepartmentsByCompanyAsync(Guid companyId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Department>().Query()
            .AsNoTracking()
            .Where(d => d.CompanyId == companyId);
            
        var totalCount = await query.CountAsync();

        var departmentData = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new 
            {
                Id = d.Id,
                Name = d.Name,
                CompanyId = d.CompanyId,
                UserIds = d.Users.Select(u => u.Id).ToList(),
                AssignedLessonIds = d.Assignments
                    .Where(a => a.Module != null && a.Module.Units != null)
                    .SelectMany(a => a.Module.Units)
                    .Where(u => u.Lessons != null)
                    .SelectMany(u => u.Lessons)
                    .Select(l => l.Id)
                    .ToList()
            })
            .ToListAsync();

        var allUserIds = departmentData.SelectMany(d => d.UserIds).Distinct().ToList();
        var allAssignedLessonIds = departmentData.SelectMany(d => d.AssignedLessonIds).Distinct().ToList();

        var completions = new List<LessonProgress>();
        if (allUserIds.Any() && allAssignedLessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && allUserIds.Contains(p.UserId) && allAssignedLessonIds.Contains(p.LessonId))
                .ToListAsync();
        }

        var dtoList = departmentData.Select(d => {
            var departmentUserIds = d.UserIds.ToHashSet();
            var departmentLessonIds = d.AssignedLessonIds.ToHashSet();
            
            var completedCount = completions.Count(c => departmentUserIds.Contains(c.UserId) && departmentLessonIds.Contains(c.LessonId));
            
            int totalPossibleCompletions = d.AssignedLessonIds.Count * d.UserIds.Count;
            double progress = totalPossibleCompletions == 0 ? 0 : Math.Round((double)completedCount / totalPossibleCompletions * 100, 1);

            return new DepartmentDto 
            { 
                Id = d.Id, 
                Name = d.Name, 
                CompanyId = d.CompanyId,
                CompletedLessons = completedCount,
                TotalLessons = totalPossibleCompletions,
                ProgressPercentage = progress
            };
        }).ToList();
            
        var pagedList = new PagedList<DepartmentDto>(dtoList, totalCount, page, pageSize);
        return Result<PagedList<DepartmentDto>>.Success(pagedList);
    }

    public async Task<Result<UserDto>> CreateUserAsync(CreateUserRequest request)
    {
        // Get department to resolve CompanyId
        var department = await _unitOfWork.Repository<Department>().Query()
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
        
        await _unitOfWork.Repository<User>().AddAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return Result<UserDto>.Success(new UserDto 
        { 
            Id = user.Id, 
            Username = user.Username, 
            Role = user.Role, 
            DepartmentId = user.DepartmentId,
            CompanyId = user.CompanyId 
        });
    }

    public async Task<Result<PagedList<UserDto>>> GetUsersByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
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
        var company = await _unitOfWork.Repository<Company>().GetByIdAsync(id);
        if (company == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        company.Name = request.Name;
        _unitOfWork.Repository<Company>().Update(company);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteCompanyAsync(Guid id)
    {
        var company = await _unitOfWork.Repository<Company>().GetByIdAsync(id);
        if (company == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        _unitOfWork.Repository<Company>().Remove(company);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request)
    {
        var department = await _unitOfWork.Repository<Department>().GetByIdAsync(id);
        if (department == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        department.Name = request.Name;
        _unitOfWork.Repository<Department>().Update(department);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteDepartmentAsync(Guid id)
    {
        var department = await _unitOfWork.Repository<Department>().GetByIdAsync(id);
        if (department == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        _unitOfWork.Repository<Department>().Remove(department);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<PagedList<UserProgressDto>>> GetDepartmentUsersProgressAsync(Guid departmentId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.DepartmentId == departmentId);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new 
            {
                Id = u.Id,
                Username = u.Username,
                Role = u.Role
            })
            .ToListAsync();

        var assignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.DepartmentId == departmentId)
            .Select(a => new 
            {
                ModuleName = a.Module != null ? a.Module.Name : "",
                LessonIds = a.Module != null && a.Module.Units != null 
                    ? a.Module.Units.Where(u => u.Lessons != null).SelectMany(u => u.Lessons).Select(l => l.Id).ToList() 
                    : new List<Guid>()
            })
            .ToListAsync();

        var assignedModulesNames = string.Join(", ", assignments.Select(a => a.ModuleName));
        var totalLessons = assignments.Sum(a => a.LessonIds.Count);
        var lessonIds = assignments.SelectMany(a => a.LessonIds).ToList();

        var userIds = users.Select(u => u.Id).ToList();
        var completions = new List<LessonProgress>();
        if (userIds.Any() && lessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && userIds.Contains(p.UserId) && lessonIds.Contains(p.LessonId))
                .ToListAsync();
        }

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

    public async Task<Result<PagedList<UserProgressDto>>> GetAllTestersProgressAsync(int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new 
            {
                Id = u.Id,
                Username = u.Username,
                Role = u.Role,
                DepartmentId = u.DepartmentId
            })
            .ToListAsync();

        var departmentIds = users.Select(u => u.DepartmentId).Distinct().ToList();

        var assignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => departmentIds.Contains(a.DepartmentId))
            .Select(a => new 
            {
                DepartmentId = a.DepartmentId,
                ModuleName = a.Module != null ? a.Module.Name : "",
                LessonIds = a.Module != null && a.Module.Units != null 
                    ? a.Module.Units.Where(u => u.Lessons != null).SelectMany(u => u.Lessons).Select(l => l.Id).ToList() 
                    : new List<Guid>()
            })
            .ToListAsync();

        var lessonIds = assignments.SelectMany(a => a.LessonIds).Distinct().ToList();
        var userIds = users.Select(u => u.Id).ToList();

        var completions = new List<LessonProgress>();
        if (userIds.Any() && lessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && userIds.Contains(p.UserId) && lessonIds.Contains(p.LessonId))
                .ToListAsync();
        }

        var progressList = users.Select(u => {
            var userAssignments = assignments.Where(a => a.DepartmentId == u.DepartmentId).ToList();
            var assignedModulesNames = string.Join(", ", userAssignments.Select(a => a.ModuleName));
            var totalLessons = userAssignments.Sum(a => a.LessonIds.Count);
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
        var totalCompanies = await _unitOfWork.Repository<Company>().Query().CountAsync();
        var activeUsers = await _unitOfWork.Repository<User>().Query().CountAsync(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester);
        var activeTesters = await _unitOfWork.Repository<User>().Query().CountAsync(u => u.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester);
        var publishedModules = await _unitOfWork.Repository<Module>().Query().CountAsync();

        var totalPossibleLessons = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.Department != null && a.Module != null)
            .Select(a => a.Department!.Users.Count * a.Module!.Units.SelectMany(u => u.Lessons).Count())
            .SumAsync();

        int totalCompleted = await _unitOfWork.Repository<LessonProgress>().Query().CountAsync(p => p.IsCompleted);

        double averageProgress = totalPossibleLessons == 0 
            ? 0 
            : Math.Round((double)totalCompleted / totalPossibleLessons * 100, 1);

        return Result<DashboardStatsDto>.Success(new DashboardStatsDto
        {
            TotalCompanies = totalCompanies,
            ActiveUsers = activeUsers,
            ActiveTesters = activeTesters,
            PublishedModules = publishedModules,
            AverageProgress = averageProgress
        });
    }
}

